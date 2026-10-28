import type {
  Repositories,
} from './repositories';
import { documentDisplayName, extensionOf } from '@/lib/document-name';
import {
  createQueries,
  type QueryContext,
} from './queries';
import type {
  DocumentFile,
  DocumentKind,
  User,
  Membership,
  OrgSettings,
  UserPrefs,
  Client,
  Contact,
  Authorization,
  TaskTemplate,
  DeadlineMove,
  Holiday,
  Task,
  TaskLine,
  VisitItem,
  Payment,
  FollowUp,
  MessageTemplate,
  Office,
  Visit,
  VisitKitItem,
  Note,
  SavedView,
  Pulse,
  ActivityEvent,
  ID,
  TaskStatus,
  Role,
  ImportPreview,
  OpenPeriodPreview,
} from '@/domain/types';


import {
  NotFoundError,
  ForbiddenError,
  VersionConflictError,
  ValidationError,
} from '@/domain/errors';
import {
  validate,
  validateReason,
  ClientWriteSchema,
  ContactWriteSchema,
  AuthorizationWriteSchema,
  TemplateWriteSchema,
  MarkVerifiedSchema,
  DeadlineMoveWriteSchema,
  HolidayWriteSchema,
  SettingsWriteSchema,
  MembershipInviteSchema,
  TaskCreateSchema,
  TaskUpdateSchema,
  MarkSubmittedSchema,
  MarkCompletedSchema,
  ChangeDueSchema,
  NextActionSchema,
  LineStatusExtraSchema,
  LineWriteSchema,
  FollowUpCreateSchema,
  MarkSentWriteSchema,
  LogResponseWriteSchema,
  MessageWriteSchema,
  OfficeWriteSchema,
  VisitWriteSchema,
  VisitUpdateSchema,
  VisitItemWriteSchema,
  VisitAddItemSchema,
  OutcomeWriteSchema,
  FinishVisitSchema,
  VisitKitWriteSchema,
  PaymentWriteSchema,
  NoteWriteSchema,
  BaselineWriteSchema,
  PulseWriteSchema,
  DocumentMetaSchema,
  DocumentUpdateSchema,
} from '@/domain/schemas';
import {
  requireOwner,
  canReviewLines,
  canCancelVisit,
} from '@/domain/policy';
import {
  isBlocked,
  blockingReason,
  canTransitionLine,
  canSetStatus,
  canFinishVisit,
  canCompleteWithEvidence,
  RuleViolationError,
} from '@/domain/rules';

import {
  todayInManila,
  addDaysToDate,
  nowInManila,
} from '@/lib/dates';
import {
  generateId,
} from '@/lib/ids';
import {
  describeDevice,
} from '@/lib/audit';



/**
 * The write side of the data layer: the rules, permission checks, validation, version checks and activity events for every
 * change, as functions over the records of one organization and the signed-in person's membership. The mock applies them to
 * its in-browser store and saves it; the Worker applies them to the records it loaded from D1 and persists exactly what
 * changed, in one batch. One copy of the rules, so the mock and the API cannot disagree (BACKEND_PLAN section 11).
 * Nothing here touches storage or the network.
 */
/**
 * Where file bytes live. The mock keeps them in IndexedDB; the Worker keeps them in R2. The commands decide what is stored
 * and under which record; the store decides the key layout, writes the bytes and mints the URL a screen can open.
 */
export interface FileStore {
  keyFor(f: { orgId: ID; clientId: ID; taskId?: ID; documentId: ID; versionNo: number; ext: string; thumb?: boolean }): string;
  put(key: string, blob: Blob): Promise<void>;
  urlFor(doc: DocumentFile, purpose: 'view' | 'download' | 'thumb'): Promise<string>;
}

export interface CommandContext extends QueryContext {
  /** Required by the document commands. */
  files?: FileStore;
  /** The caller's user agent, for the activity log's device column. */
  userAgent?: string;
}

// ---- Class-level write guards -------------------------------------------------------------------------------
// Fields a HELPER may send to each generic create, update or upsert. The lists are the fields the screens
// actually send; every other field is FORBIDDEN for a helper. Status, review, due-date and override fields
// change only through setStatus, changeDue and override. The owner is not restricted by these lists.
export const HELPER_FIELDS: Record<string, readonly string[]> = {
  'tasks.create': ['clientId', 'templateId', 'title', 'kind', 'period', 'transactionDate', 'dueDate', 'dueSource', 'channel', 'ownerUserId', 'officeAction', 'paymentExpected', 'tags', 'notes'],
  'tasks.update': ['ownerUserId'],
  'lines.addAdHoc': ['label', 'required', 'copyForm', 'copies', 'suppliedBy', 'printAndBring', 'reviewNote', 'neededBy'],
  'lines.update': [],
  'documents.upload': ['clientId', 'taskId', 'lineId', 'visitItemId', 'paymentId', 'authorizationId', 'kind', 'source'],
  'documents.update': [],
  'visits.create': ['officeId', 'officeType', 'officeName', 'rdoCode', 'plannedDate', 'arriveBy', 'assigneeUserId', 'purpose'],
  'visits.create.item': ['taskId', 'action', 'questions'],
  'visits.update': ['plannedDate'],
  'visits.updateItem': ['questions'],
  'payments.save': ['id', 'clientId', 'taskId', 'amount', 'paidOn', 'channel', 'provider', 'referenceNo', 'paidBy', 'reimbursement', 'proofDocumentIds', 'note'],
  'contacts.upsert': ['id', 'clientId', 'name', 'title', 'role', 'phoneE164', 'email', 'preferredChannel', 'language', 'isSignatory', 'notes'],
  'authorizations.upsert': ['id', 'clientId', 'type', 'granteeUserId', 'scope', 'issuedOn', 'validUntil', 'notarized'],
  'clients.upsert': ['id', 'displayName', 'code', 'entityType', 'rdoCode', 'registeredName', 'tinMasked', 'hasTin', 'vatStatus', 'sizeClass', 'filingChannel', 'efpsGroup', 'orusEnrolled', 'accessHolder', 'usesInvoicingSoftware', 'fiscalYearEndMonth', 'preferredLanguage'],
  'followUps.create': ['clientId', 'taskId', 'contactId', 'channel', 'language', 'templateId', 'expectedBy', 'lineIds'],
  'notes.save': ['id', 'entity', 'entityId', 'body', 'pinned'],
};

/**
 * The version an editor loaded rides along in the patch as `version`. It is not a field to write: take it out
 * before the helper allowlist, the schemas and the merge see the patch.
 */
export function takeVersion<T extends { version?: number }>(patch: T): { rest: Omit<T, 'version'>; expected: number | undefined } {
  const { version, ...rest } = patch;
  return { rest, expected: version };
}

/** A stale (or future) version fails with VERSION_CONFLICT carrying the stored record. No version skips the check. */
export function assertVersion(current: { version: number }, expected: number | undefined): void {
  if (expected !== undefined && expected !== current.version) throw new VersionConflictError(current);
}

export function createCommands(ctx: CommandContext) {
  const { store } = ctx;
  const queries = createQueries(ctx);
  const { actor, assertOwner, assertClient, assertTask, assertLine, assertDocument, assertFollowUp, assertPayment, canReachVisit, isVisitListable, assertVisit, assertVisitItem, assertNoteTarget, isClientAllowed, scopedInsightData, buildTaskSummary, buildClientSummary, buildVisitSummary } = queries;
  const getCurrentUser = (): { user: User; membership: Membership } => ({ user: ctx.user, membership: ctx.membership });

  // Every key ending in Id or Ids names another record. Which collection it points into:
  const REFERENCE_COLLECTIONS: Record<string, () => Array<{ id: ID; clientId?: ID }>> = {
    taskId: () => store.tasks,
    lineId: () => store.taskLines,
    lineIds: () => store.taskLines,
    packedLineIds: () => store.taskLines,
    documentId: () => store.documents,
    documentIds: () => store.documents,
    evidenceDocumentIds: () => store.documents,
    proofDocumentIds: () => store.documents,
    replacesId: () => store.documents,
    paymentId: () => store.payments,
    visitItemId: () => store.visitItems,
    authorizationId: () => store.authorizations,
    replacedById: () => store.authorizations,
    contactId: () => store.contacts,
    followUpId: () => store.followUps,
    visitId: () => store.visits,
  };

  /** Keys that end in Id but do not point at client-scoped records: the record itself, people, offices, templates. */
  const NON_CLIENT_REFERENCES = new Set(['id', 'orgId', 'clientId', 'officeId', 'rdoOfficeId', 'templateId', 'taskTemplateId', 'requirementTemplateId', 'kitItemId', 'batchId']);

  const isUserReference = (key: string) => /(^|[a-z])UserIds?$/.test(key) || key === 'userId';

  /** Throws RULE_VIOLATION when canSetStatus refuses; a blocked task says why and that only an owner override can move it. */
  function assertCanSetStatus(task: Task, lines: TaskLine[], to: TaskStatus, role: Role): void {
    if (canSetStatus(task, lines, to, role)) return;
    if (isBlocked(task, lines)) {
      throw new RuleViolationError(
        `Task is blocked: ${blockingReason(lines) ?? 'required lines are not accepted'}. Only an owner override with a reason can change its status.`,
      );
    }
    throw new RuleViolationError(`Cannot transition task to ${to}`);
  }

  /** An update patch may not re-point a record: identity and parent ids stay as stored (moving to an unreachable client is FORBIDDEN first). */
  function rejectIdentityChange(patch: object, existing: object | undefined): void {
    if (!existing) return;
    for (const key of ['id', 'orgId', 'clientId', 'taskId', 'visitId'] as const) {
      if (!(key in patch)) continue;
      const next = (patch as Record<string, unknown>)[key];
      if (next === (existing as Record<string, unknown>)[key]) continue;
      if (key === 'clientId' && typeof next === 'string') assertClient(next);
      throw new RuleViolationError(`${key} cannot be changed`);
    }
  }

  /** Writes to a stored record check the record's own client as well as the client the caller supplied. */
  function assertRecordWrite(list: Array<{ id: ID; clientId: ID }>, id: ID | undefined, suppliedClientId?: ID): void {
    const stored = id ? list.find((x) => x.id === id) : undefined;
    if (stored) assertClient(stored.clientId);
    assertClient(suppliedClientId ?? stored?.clientId);
  }

  function assertCanReview(): void {
    if (!canReviewLines(actor(), store.settings)) {
      throw new ForbiddenError('The practice owner has turned off line review for helpers');
    }
  }

  /** A helper may send only allowlisted fields (a key with an undefined value is not sent). */
  function assertPatch(method: string, patch: object | undefined): void {
    if (!patch || actor().role === 'owner') return;
    const allowed = HELPER_FIELDS[method];
    if (!allowed) throw new ForbiddenError(`Helpers cannot use ${method}`);
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined && !allowed.includes(key)) {
        throw new ForbiddenError(`Helpers cannot set ${key} through ${method}`);
      }
    }
  }

  /**
   * Shared reference check for every create and update: each Id or Ids key must point at a record that belongs to
   * the same client as the record being written, and one the current user can reach. A reference that matches
   * no record is left alone. For a helper an unrecognised reference key is refused.
   */
  function assertReferences(record: object | undefined, clientId: ID | undefined): void {
    if (!record) return;
    const isHelper = actor().role !== 'owner';
    for (const [key, value] of Object.entries(record)) {
      if (value === undefined || value === null || !/Ids?$/.test(key)) continue;
      if (NON_CLIENT_REFERENCES.has(key) || isUserReference(key)) continue;
      const source = REFERENCE_COLLECTIONS[key];
      if (!source) {
        if (isHelper) throw new ForbiddenError(`Helpers cannot set ${key}`);
        continue;
      }
      const ids = Array.isArray(value) ? value : [value];
      for (const refId of ids) {
        const target = source().find((x) => x.id === refId);
        if (!target) continue;
        if (key === 'visitId') {
          if (!canReachVisit(target.id)) throw new ForbiddenError("You don't have access to this visit");
          continue;
        }
        if (target.clientId) assertClient(target.clientId);
        if (clientId && target.clientId && target.clientId !== clientId) {
          throw new RuleViolationError(`${key} points at a record of another client`);
        }
      }
    }
  }

  /** Save-or-update by id: an existing row keeps its other fields and changes only what was sent; a new row is appended. */
  function upsertRow<T extends { id: ID; version: number; updatedAt: string; updatedBy: string }>(
    list: T[],
    created: T,
    patch: Partial<T>,
    userId: ID,
  ): T {
    const { rest, expected } = takeVersion(patch as Partial<T> & { version?: number });
    const idx = rest.id ? list.findIndex((x) => x.id === rest.id) : -1;
    if (idx < 0) {
      list.push(created);
      return created;
    }
    const old = list[idx];
    assertVersion(old, expected);
    const sent = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as Partial<T>;
    list[idx] = { ...old, ...sent, id: old.id, version: old.version + 1, updatedAt: nowInManila(), updatedBy: userId };
    return list[idx];
  }

  function logActivity(
    action: ActivityEvent['action'],
    entity: ActivityEvent['entity'],
    entityId: ID,
    summary: string,
    clientId?: ID,
    reason?: string
  ) {
    const { user } = getCurrentUser();
    const event: ActivityEvent = {
      id: generateId(),
      orgId: store.org.id,
      at: nowInManila(),
      actorId: user.id,
      entity,
      entityId,
      clientId,
      action,
      summary,
      reason,
      device: describeDevice(ctx.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : undefined)),
    };
    store.activity.unshift(event);
  }

  const memberships: Pick<Repositories['memberships'], 'invite' | 'update' | 'revoke'> = {
    async invite(m) {
      validate(MembershipInviteSchema, m);
      const { user, membership } = getCurrentUser();
      if (membership.role !== 'owner') {
        throw new ForbiddenError('Access denied: Only practice owners can manage operator memberships');
      }
      // one person per address: the API's unique index would otherwise answer an unhandled error
      if (store.memberships.some((x) => x.email.toLowerCase() === m.email.toLowerCase())) {
        throw new ValidationError({ email: ['This address is already invited or a member'] });
      }
      const name = m.name || m.email.split('@')[0];
      const initials = name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase() || 'OP';
      const newUserId = generateId();

      const newUser: User = {
        id: newUserId,
        name,
        email: m.email,
        initials,
        displayName: name,
        lastSignInAt: undefined,
      };
      store.users.push(newUser);

      const newM: Membership & { name?: string; initials?: string } = {
        id: generateId(),
        orgId: store.org.id,
        userId: newUserId,
        email: m.email,
        role: m.role,
        clientIds: m.clientIds || [],
        active: true,
        invitedAt: todayInManila() + 'T00:00:00+08:00',
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
        name,
        initials,
      };
      store.memberships.push(newM);
      logActivity('access_granted', 'membership', newM.id, `Invited ${name} (${m.email}) as ${m.role}`);
      return newM;
    },
    async update(id, input) {
      const { membership: callerMembership } = getCurrentUser();
      if (callerMembership.role !== 'owner') {
        throw new ForbiddenError('Access denied: Only practice owners can manage operator memberships');
      }
      const { rest: m, expected } = takeVersion(input);
      const index = store.memberships.findIndex((item) => item.id === id);
      if (index === -1) throw new NotFoundError('Membership not found');
      assertVersion(store.memberships[index], expected);
      store.memberships[index] = { ...store.memberships[index], ...m, version: store.memberships[index].version + 1 };
      if (m.name) {
        const u = store.users.find((user) => user.id === store.memberships[index].userId || user.email === store.memberships[index].email);
        if (u) {
          u.name = m.name;
          u.displayName = m.name;
        }
      }
      if (m.active === true && store.memberships[index].revokedAt) {
        delete store.memberships[index].revokedAt;
      }
      logActivity('updated', 'membership', id, `Updated account permissions for ${store.memberships[index].email}`);
      const updatedUser = store.users.find((user) => user.id === store.memberships[index].userId || user.email === store.memberships[index].email);
      return {
        ...store.memberships[index],
        name: updatedUser?.name || m.name,
        initials: updatedUser?.initials || 'OP',
      };
    },
    async revoke(id) {
      const { membership: callerMembership } = getCurrentUser();
      if (callerMembership.role !== 'owner') {
        throw new ForbiddenError('Access denied: Only practice owners can manage operator memberships');
      }
      const m = store.memberships.find((item) => item.id === id);
      if (m) {
        m.active = false;
        m.revokedAt = todayInManila() + 'T00:00:00+08:00';
        logActivity('access_revoked', 'membership', id, `Revoked access for ${m.email}`);
      }
    },
  };

  const settings: Pick<Repositories['settings'], 'save'> = {
    async save(s: Partial<OrgSettings>) {
      assertOwner();
      const { rest: patch, expected } = takeVersion(s);
      validate(SettingsWriteSchema, patch);
      assertVersion(store.settings, expected);
      // Field names only: values such as the mobile number or accreditation stay out of the activity log
      const changed = Object.keys(patch).filter(
        (key) => key !== 'orgId' && key !== 'updatedAt' && JSON.stringify((patch as Record<string, unknown>)[key]) !== JSON.stringify((store.settings as unknown as Record<string, unknown>)[key]),
      );
      store.settings = { ...store.settings, ...patch, updatedAt: todayInManila() + 'T00:00:00+08:00', version: store.settings.version + 1 };
      if (changed.length > 0) logActivity('updated', 'settings', store.org.id, `Updated practice settings: ${changed.join(', ')}`);
      return store.settings;
    },
  };

  const prefs: Pick<Repositories['prefs'], 'save'> = {
    async save(p: Partial<UserPrefs>) {
      const { user } = getCurrentUser();
      store.prefs[user.id] = { ...store.prefs[user.id], ...p };
      return store.prefs[user.id];
    },
  };

  const clients: Pick<Repositories['clients'], 'upsert' | 'archive' | 'restore' | 'revealTin' | 'findDuplicates' | 'importPreview' | 'importCommit' | 'importUndo'> = {
    async upsert(input) {
      const { rest: c, expected } = takeVersion(input);
      assertPatch('clients.upsert', c);
      if (c.id) assertClient(c.id); else assertOwner();
      validate(ClientWriteSchema, c);
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      if (c.id) {
        const index = store.clients.findIndex((item) => item.id === c.id);
        if (index === -1) throw new NotFoundError('Client not found');
        assertVersion(store.clients[index], expected);
        store.clients[index] = {
          ...store.clients[index],
          ...c,
          updatedAt: now,
          updatedBy: user.id,
          version: store.clients[index].version + 1,
        };
        logActivity('updated', 'client', c.id, `Updated client ${store.clients[index].displayName}`, c.id);
        return store.clients[index];
      } else {
        const newClient: Client = {
          id: generateId(),
          orgId: store.org.id,
          code: c.code || 'NEW',
          displayName: c.displayName || 'New Client',
          registeredName: c.registeredName,
          importBatchId: c.importBatchId,
          entityType: c.entityType || 'solo',
          hasTin: c.hasTin ?? true,
          tinMasked: c.tinMasked || (c.tinFull ? `•••-•••-${c.tinFull.slice(-3)}-00000` : '•••-•••-000-00000'),
          tinFull: c.tinFull,
          rdoCode: c.rdoCode || '039',
          vatStatus: c.vatStatus || 'unknown',
          sizeClass: c.sizeClass || 'micro',
          orusEnrolled: c.orusEnrolled ?? false,
          accessHolder: c.accessHolder || 'unknown',
          usesInvoicingSoftware: c.usesInvoicingSoftware ?? false,
          fiscalYearEndMonth: c.fiscalYearEndMonth || 12,
          preferredLanguage: c.preferredLanguage || 'en',
          assignedUserIds: c.assignedUserIds || [user.id],
          tags: c.tags || [],
          status: 'active',
          createdAt: now,
          createdBy: user.id,
          updatedAt: now,
          updatedBy: user.id,
          version: 1,
        };
        store.clients.push(newClient);
        logActivity('created', 'client', newClient.id, `Created client ${newClient.displayName}`, newClient.id);
        return newClient;
      }
    },
    async archive(id, reason) {
      assertClient(id);
      validateReason(reason);
      const client = store.clients.find((c) => c.id === id);
      if (client) {
        client.status = 'archived';
        client.archivedReason = reason;
        logActivity('archived', 'client', id, `Archived client: ${reason}`, id, reason);
      }
    },
    async restore(id, reason) {
      assertClient(id);
      validateReason(reason);
      const client = store.clients.find((c) => c.id === id);
      if (client) {
        client.status = 'active';
        logActivity('restored', 'client', id, `Restored client: ${reason}`, id, reason);
      }
    },
    async revealTin(id) {
      assertClient(id);
      const client = store.clients.find((c) => c.id === id);
      if (!client) throw new NotFoundError('Client not found');
      logActivity('tin_revealed', 'client', id, `Revealed TIN for ${client.displayName}`, id);
      return client.tinFull || '000-000-000-00000';
    },
    async findDuplicates(c) {
      assertOwner();
      const matches = store.clients.filter(
        (item) =>
          (c.code && item.code.toLowerCase() === c.code.toLowerCase()) ||
          (c.name && item.displayName.toLowerCase() === c.name.toLowerCase()) ||
          (c.tin && item.tinFull === c.tin)
      );
      return matches.map(buildClientSummary);
    },
    async importPreview(rows, mapping) {
      assertOwner();
      const valid: Partial<Client>[] = [];
      const errors: ImportPreview['errors'] = [];
      const batchId = generateId();

      rows.forEach((r, idx) => {
        const rawCode = r[mapping.code as string];
        const code = (rawCode ? String(rawCode).trim() : `IMP${idx + 1}`).toUpperCase();
        const displayName = r[mapping.displayName as string] ? String(r[mapping.displayName as string]).trim() : '';
        const tin = r[mapping.tin as string] ? String(r[mapping.tin as string]).trim() : undefined;

        const codeDuplicate = store.clients.find((c) => !c.deletedAt && c.code.toUpperCase() === code);
        const nameDuplicate = displayName ? store.clients.find((c) => !c.deletedAt && c.displayName.toLowerCase() === displayName.toLowerCase()) : undefined;

        if (!displayName) {
          errors.push({ row: idx + 1, field: 'displayName', message: 'Client name is required' });
        } else if (codeDuplicate) {
          errors.push({ row: idx + 1, field: 'code', message: `Duplicate client code: ${code}` });
        } else if (nameDuplicate) {
          errors.push({ row: idx + 1, field: 'displayName', message: `Duplicate client name: ${displayName}` });
        } else {
          valid.push({
            code,
            displayName,
            entityType: (r[mapping.entityType as string] as any) || 'solo',
            vatStatus: (r[mapping.vatStatus as string] as any) || 'vat',
            sizeClass: 'small',
            rdoCode: r[mapping.rdoCode as string] || '039',
            tinFull: tin,
            tinMasked: tin ? `•••-•••-${tin.replace(/\D/g, '').slice(-3)}-00000` : undefined,
            hasTin: Boolean(tin),
            status: 'active',
          });
        }
      });

      return { batchId, totalRows: rows.length, validRows: valid, errors };
    },
    async importCommit(preview) {
      assertOwner();
      const createdIds: ID[] = [];
      const { user } = getCurrentUser();
      const now = nowInManila();
      const batches = (store.importBatches ??= []);
      if (batches.some((b) => b.id === preview.batchId)) throw new RuleViolationError('This import was already committed');
      for (const row of preview.validRows) {
        const client = await clients.upsert({ ...row, importBatchId: preview.batchId } as never);
        createdIds.push(client.id);
      }
      batches.push({
        id: preview.batchId,
        orgId: store.org.id,
        totalRows: preview.validRows.length + preview.errors.length,
        createdCount: createdIds.length,
        skippedCount: preview.errors.length,
        createdAt: now,
        createdBy: user.id,
      });
      return { created: createdIds, skipped: preview.errors.length, batchId: preview.batchId };
    },
    async importUndo(batchId) {
      assertOwner();
      const batch = (store.importBatches ??= []).find((b) => b.id === batchId);
      if (!batch) throw new NotFoundError('Import not found');
      if (batch.undoneAt) throw new RuleViolationError('This import was already undone');
      const now = nowInManila();
      const members = store.clients.filter((c) => c.importBatchId === batchId && !c.deletedAt);
      for (const cl of members) {
        cl.deletedAt = now;
        cl.deletedReason = 'Import batch undo rollback';
        cl.version += 1;
      }
      batch.undoneAt = now;
      logActivity('deleted', 'client', batchId, `Undid client import batch (${members.length} removed)`);
    },
  };

  const contacts: Pick<Repositories['contacts'], 'upsert' | 'remove'> = {
    async upsert(input) {
      const { rest: c, expected } = takeVersion(input);
      assertPatch('contacts.upsert', c);
      const storedContact = c.id ? store.contacts.find((x) => x.id === c.id) : undefined;
      assertReferences(c, storedContact?.clientId ?? c.clientId);
      assertRecordWrite(store.contacts, c.id, c.clientId);
      rejectIdentityChange(c, storedContact);
      validate(ContactWriteSchema, c);
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      if (c.id) {
        const idx = store.contacts.findIndex((item) => item.id === c.id);
        if (idx === -1) throw new NotFoundError('Contact not found');
        assertVersion(store.contacts[idx], expected);
        store.contacts[idx] = { ...store.contacts[idx], ...c, updatedAt: now, version: store.contacts[idx].version + 1 };
        return store.contacts[idx];
      } else {
        const newC: Contact = {
          id: generateId(),
          orgId: store.org.id,
          clientId: c.clientId!,
          name: c.name || 'New Contact',
          preferredChannel: c.preferredChannel || 'viber',
          language: c.language || 'en',
          isSignatory: c.isSignatory ?? false,
          createdAt: now,
          createdBy: user.id,
          updatedAt: now,
          updatedBy: user.id,
          version: 1,
        };
        store.contacts.push(newC);
        return newC;
      }
    },
    async remove(id, reason) {
      assertClient(store.contacts.find((x) => x.id === id)?.clientId);
      validateReason(reason);
      const c = store.contacts.find((item) => item.id === id);
      if (c) {
        c.deletedAt = todayInManila() + 'T00:00:00+08:00';
        c.deletedReason = reason;
      }
    },
  };

  const authorizations: Pick<Repositories['authorizations'], 'upsert' | 'replace'> = {
    async upsert(input) {
      const { rest: a, expected } = takeVersion(input);
      assertPatch('authorizations.upsert', a);
      const storedAuth = a.id ? store.authorizations.find((x) => x.id === a.id) : undefined;
      assertReferences(a, storedAuth?.clientId ?? a.clientId);
      assertRecordWrite(store.authorizations, a.id, a.clientId);
      rejectIdentityChange(a, storedAuth);
      validate(AuthorizationWriteSchema, a);
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      if (a.id) {
        const idx = store.authorizations.findIndex((item) => item.id === a.id);
        if (idx === -1) throw new NotFoundError('Authorization not found');
        assertVersion(store.authorizations[idx], expected);
        store.authorizations[idx] = { ...store.authorizations[idx], ...a, updatedAt: now, version: store.authorizations[idx].version + 1 };
        return store.authorizations[idx];
      } else {
        const newA: Authorization = {
          id: generateId(),
          orgId: store.org.id,
          clientId: a.clientId!,
          type: a.type || 'spa',
          scope: a.scope || ['filing', 'payment'],
          granteeUserId: a.granteeUserId || user.id,
          issuedOn: a.issuedOn || todayInManila(),
          validUntil: a.validUntil,
          notarized: a.notarized ?? true,
          createdAt: now,
          createdBy: user.id,
          updatedAt: now,
          updatedBy: user.id,
          version: 1,
        };
        store.authorizations.push(newA);
        return newA;
      }
    },
    async replace(oldId, next) {
      assertPatch('authorizations.upsert', next);
      assertClient(store.authorizations.find((x) => x.id === oldId)?.clientId ?? next.clientId);
      validate(AuthorizationWriteSchema, next);
      const created = await authorizations.upsert(next);
      const old = store.authorizations.find((a) => a.id === oldId);
      if (old) {
        old.replacedById = created.id;
      }
      return created;
    },
  };

  const templates: Pick<Repositories['templates'], 'save' | 'markVerified'> = {
    async save(input, lines) {
      assertOwner();
      const { rest: t, expected } = takeVersion(input);
      validate(TemplateWriteSchema, t);
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      let template: TaskTemplate;
      if (t.id) {
        const idx = store.templates.findIndex((item) => item.id === t.id);
        if (idx < 0) throw new NotFoundError('Template not found');
        assertVersion(store.templates[idx], expected);
        store.templates[idx] = { ...store.templates[idx], ...t, updatedAt: now, version: store.templates[idx].version + 1 };
        template = store.templates[idx];
      } else {
        template = {
          id: generateId(),
          orgId: store.org.id,
          code: t.code || 'CUSTOM',
          name: t.name || 'New Template',
          kind: t.kind || 'filing',
          frequency: t.frequency || 'monthly',
          appliesTo: t.appliesTo || {},
          officeAction: t.officeAction ?? false,
          paymentExpected: t.paymentExpected ?? false,
          verified: false,
          active: true,
          createdAt: now,
          createdBy: user.id,
          updatedAt: now,
          updatedBy: user.id,
          version: 1,
        };
        store.templates.push(template);
      }
      // Requirement lines are replaced only when lines are sent (BACKEND_PLAN 4.4); sending none leaves them as they are
      if (lines && lines.length > 0) {
        store.reqTemplates = store.reqTemplates.filter((l) => l.taskTemplateId !== template.id);
        lines.forEach((l, i) => {
          store.reqTemplates.push({
            id: l.id || generateId(),
            orgId: store.org.id,
            taskTemplateId: template.id,
            label: l.label || 'Requirement',
            description: l.description,
            required: l.required ?? true,
            copyForm: l.copyForm || 'original',
            copies: l.copies,
            suppliedBy: l.suppliedBy || 'client',
            validityDays: l.validityDays,
            sortOrder: l.sortOrder ?? i + 1,
            sourceRef: l.sourceRef,
            verified: false,
            createdAt: now,
            createdBy: user.id,
            updatedAt: now,
            updatedBy: user.id,
            version: 1,
          });
        });
      }
      return template;
    },
    async markVerified(id, v) {
      assertOwner();
      validate(MarkVerifiedSchema, v);
      const t = store.templates.find((item) => item.id === id);
      if (!t) throw new NotFoundError('Template not found');
      t.verified = true;
      t.verifiedOn = v.verifiedOn;
      t.sourceRef = v.sourceRef;
      return t;
    },
  };

  const deadlineMoves: Pick<Repositories['deadlineMoves'], 'save' | 'remove'> = {
    async save(m, applyToOpenTasks) {
      assertOwner();
      validate(DeadlineMoveWriteSchema, m);
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      const move: DeadlineMove = {
        id: m.id || generateId(),
        orgId: store.org.id,
        templateId: m.templateId,
        period: m.period || '2026-09',
        newDueDate: m.newDueDate || todayInManila(),
        sourceRef: m.sourceRef || 'BIR Advisory',
        createdAt: now,
        createdBy: user.id,
        updatedAt: now,
        updatedBy: user.id,
        version: 1,
      };
      store.deadlineMoves.push(move);

      const updatedIds: ID[] = [];
      if (applyToOpenTasks) {
        store.tasks.forEach((t) => {
          if ((!move.templateId || t.templateId === move.templateId) && t.period === move.period) {
            t.dueDate = move.newDueDate;
            t.dueSource = { kind: 'deadline_move', ref: move.sourceRef };
            updatedIds.push(t.id);
          }
        });
      }
      return { move, updatedTaskIds: updatedIds };
    },
    async remove(id, reason) {
      assertOwner();
      validateReason(reason);
      store.deadlineMoves = store.deadlineMoves.filter((m) => m.id !== id);
    },
  };

  const holidays: Pick<Repositories['holidays'], 'save' | 'remove'> = {
    async save(h) {
      assertOwner();
      validate(HolidayWriteSchema, h);
      const newH: Holiday = {
        id: h.id || generateId(),
        orgId: store.org.id,
        date: h.date || todayInManila(),
        name: h.name || 'Holiday',
        type: h.type || 'regular',
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: 'user',
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: 'user',
        version: 1,
      };
      const saved = upsertRow(store.holidays, newH, h, getCurrentUser().user.id);
      return saved;
    },
    async remove(id) {
      assertOwner();
      store.holidays = store.holidays.filter((h) => h.id !== id);
    },
  };

  const tasks: Pick<Repositories['tasks'], 'create' | 'update' | 'setStatus' | 'markSubmitted' | 'markCompleted' | 'override' | 'clearOverride' | 'changeDue' | 'setNextAction' | 'archive' | 'restore' | 'duplicateForNextPeriod' | 'previewOpenPeriod' | 'openPeriod'> = {
    async create(t, lines) {
      assertPatch('tasks.create', t);
      assertReferences(t, t.clientId);
      for (const l of lines ?? []) {
        assertPatch('lines.addAdHoc', l);
        assertReferences(l, t.clientId);
      }
      assertClient(t.clientId);
      validate(TaskCreateSchema, t);
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      const newTask: Task = {
        id: generateId(),
        orgId: store.org.id,
        clientId: t.clientId!,
        templateId: t.templateId,
        title: t.title,
        kind: t.kind || 'filing',
        period: t.period,
        transactionDate: t.transactionDate,
        dueDate: t.dueDate || todayInManila(),
        dueSource: t.dueSource || { kind: 'manual' },
        ownerUserId: t.ownerUserId || user.id,
        officeAction: t.officeAction ?? false,
        paymentExpected: t.paymentExpected ?? false,
        status: 'in_preparation',
        tags: t.tags || [],
        createdAt: now,
        createdBy: user.id,
        updatedAt: now,
        updatedBy: user.id,
        version: 1,
      };
      store.tasks.push(newTask);

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        store.taskLines.push({
          id: generateId(),
          orgId: store.org.id,
          taskId: newTask.id,
          clientId: newTask.clientId,
          label: l.label || 'Requirement',
          required: l.required ?? true,
          copyForm: l.copyForm || 'digital',
          copies: l.copies,
          suppliedBy: l.suppliedBy || 'client',
          printAndBring: l.printAndBring ?? false,
          status: 'not_requested',
          sortOrder: i + 1,
          lateDiscovered: false,
          documentIds: [],
          createdAt: now,
          createdBy: user.id,
          updatedAt: now,
          updatedBy: user.id,
          version: 1,
        });
      }

      logActivity('created', 'task', newTask.id, `Created task ${newTask.title || 'Task'}`, newTask.clientId);
      return newTask;
    },
    async update(id, input) {
      const { rest: t, expected } = takeVersion(input);
      assertPatch('tasks.update', t);
      assertReferences(t, store.tasks.find((x) => x.id === id)?.clientId);
      assertTask(id);
      rejectIdentityChange(t, store.tasks.find((x) => x.id === id));
      validate(TaskUpdateSchema, t);
      const idx = store.tasks.findIndex((item) => item.id === id);
      if (idx === -1) throw new NotFoundError('Task not found');
      assertVersion(store.tasks[idx], expected);
      store.tasks[idx] = { ...store.tasks[idx], ...t, version: store.tasks[idx].version + 1 };
      return store.tasks[idx];
    },
    async setStatus(id, to, reason) {
      assertTask(id);
      if (reason !== undefined) validateReason(reason);
      const { user, membership } = getCurrentUser();
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new NotFoundError('Task not found');
      const lines = store.taskLines.filter((l) => l.taskId === id);

      assertCanSetStatus(task, lines, to, membership.role);

      task.status = to;
      task.version += 1;
      logActivity('status_changed', 'task', id, `Changed status to ${to}`, task.clientId, reason);
      return task;
    },
    async markSubmitted(id, s) {
      assertTask(id);
      validate(MarkSubmittedSchema, s);
      const { membership } = getCurrentUser();
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new NotFoundError('Task not found');
      assertCanSetStatus(task, store.taskLines.filter((l) => l.taskId === id), 'submitted', membership.role);
      task.status = 'submitted';
      task.submittedAt = s.on + 'T00:00:00+08:00';
      task.submittedVia = s.via;
      task.submissionRef = s.ref;
      task.version += 1;
      logActivity('status_changed', 'task', id, `Submitted via ${s.via}`, task.clientId);
      return task;
    },
    async markCompleted(id, c) {
      assertTask(id);
      validate(MarkCompletedSchema, c);
      const { membership } = getCurrentUser();
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new NotFoundError('Task not found');
      assertCanSetStatus(task, store.taskLines.filter((l) => l.taskId === id), 'completed', membership.role);
      const hasEvidence = store.documents.some(
        (d) => d.taskId === id && !d.deletedAt && (d.kind === 'filed_return' || d.kind === 'acknowledgment'),
      );
      if (!canCompleteWithEvidence(hasEvidence, c.noEvidenceReason)) {
        throw new RuleViolationError('Attach the filed return or acknowledgment, or give a reason of at least 10 characters');
      }
      task.status = 'completed';
      task.completedAt = c.on + 'T00:00:00+08:00';
      task.completionNoEvidenceReason = c.noEvidenceReason;
      task.version += 1;
      logActivity('status_changed', 'task', id, 'Completed task', task.clientId);
      return task;
    },
    async override(id, status, reason) {
      assertOwner();
      validateReason(reason);
      const { user, membership } = getCurrentUser();
      if (membership.role !== 'owner') throw new ForbiddenError('Only owners can override task status');
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new NotFoundError('Task not found');
      task.statusOverride = {
        status,
        reason,
        by: user.id,
        at: todayInManila() + 'T00:00:00+08:00',
      };
      task.version += 1;
      logActivity('overridden', 'task', id, `Status overridden to ${status}: ${reason}`, task.clientId, reason);
      return task;
    },
    async clearOverride(id, reason) {
      assertOwner();
      validateReason(reason);
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new NotFoundError('Task not found');
      delete task.statusOverride;
      task.version += 1;
      logActivity('overridden', 'task', id, `Cleared status override: ${reason}`, task.clientId, reason);
      return task;
    },
    async changeDue(id, dueDate, ref, reason, url) {
      assertOwner();
      validate(ChangeDueSchema, { dueDate, ref, reason, url });
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new NotFoundError('Task not found');
      task.dueDate = dueDate;
      task.dueSource = { kind: 'override', ref };
      task.version += 1;
      logActivity('due_changed', 'task', id, `Due changed to ${dueDate}: ${reason}`, task.clientId, reason);
      return task;
    },
    async setNextAction(id, next) {
      assertTask(id);
      if (next) validate(NextActionSchema, next);
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new NotFoundError('Task not found');
      task.nextAction = next || undefined;
      task.version += 1;
      return task;
    },
    async archive(id, reason) {
      assertTask(id);
      validateReason(reason);
      const task = store.tasks.find((item) => item.id === id);
      if (task) {
        task.status = 'archived';
        task.archivedReason = reason;
        logActivity('archived', 'task', id, `Archived task: ${reason}`, task.clientId, reason);
      }
    },
    async restore(id, reason) {
      assertTask(id);
      validateReason(reason);
      const task = store.tasks.find((item) => item.id === id);
      if (task) {
        task.status = 'in_preparation';
        logActivity('restored', 'task', id, `Restored task: ${reason}`, task.clientId, reason);
      }
    },
    async duplicateForNextPeriod(id) {
      assertTask(id);
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new NotFoundError('Task not found');
      // Pass tasks.create only the line fields it accepts, never the stored records (their id, status and
      // review fields are not the caller's to set, and a helper's create is held to the helper allowlist)
      const lines = store.taskLines
        .filter((l) => l.taskId === id)
        .map((l) => ({
          label: l.label,
          required: l.required,
          copyForm: l.copyForm,
          copies: l.copies,
          suppliedBy: l.suppliedBy,
          printAndBring: l.printAndBring,
        }));
      return tasks.create(
        {
          clientId: task.clientId,
          templateId: task.templateId,
          title: task.title,
          kind: task.kind,
          officeAction: task.officeAction,
          paymentExpected: task.paymentExpected,
        },
        lines
      );
    },
    async previewOpenPeriod(period, clientIds) {
      assertOwner();
      const applicable: OpenPeriodPreview['applicableTasks'] = [];
      const clients = store.clients.filter((c) => clientIds.includes(c.id));

      for (const client of clients) {
        for (const tmpl of store.templates) {
          applicable.push({
            clientId: client.id,
            clientName: client.displayName,
            templateId: tmpl.id,
            templateName: tmpl.name,
            kind: tmpl.kind,
            calculatedDue: todayInManila(),
            linesCount: 2,
          });
        }
      }

      return { period, clientCount: clients.length, applicableTasks: applicable };
    },
    async openPeriod(plan) {
      assertOwner();
      const createdIds: ID[] = [];
      let skipped = 0;
      for (const item of plan.selections) {
        const existing = store.tasks.find(
          (t) => !t.deletedAt && t.clientId === item.clientId && t.templateId === item.templateId && t.period === plan.period
        );
        if (existing) {
          skipped++;
          continue;
        }

        const tmpl = store.templates.find((t) => t.id === item.templateId);
        const reqs = store.reqTemplates.filter((r) => r.taskTemplateId === item.templateId);
        const task = await tasks.create(
          {
            clientId: item.clientId,
            templateId: item.templateId,
            title: `${tmpl?.name || 'Task'} — ${plan.period}`,
            period: plan.period,
            dueDate: item.dueDate,
            kind: tmpl?.kind || 'filing',
          },
          reqs
        );
        createdIds.push(task.id);
      }
      return { created: createdIds, skipped, lines: createdIds.length * 2 };
    },
  };

  const lines: Pick<Repositories['lines'], 'setStatus' | 'addAdHoc' | 'update' | 'reorder'> = {
    async setStatus(id, to, extra) {
      assertLine(id);
      if (['under_review', 'accepted', 'incomplete', 'needs_correction'].includes(to)) assertCanReview();
      if (extra) validate(LineStatusExtraSchema, extra);
      const { user } = getCurrentUser();
      const line = store.taskLines.find((l) => l.id === id);
      if (!line) throw new NotFoundError('Line not found');

      if (!canTransitionLine(line.status, to)) {
        throw new RuleViolationError(`Cannot transition line from ${line.status} to ${to}`);
      }

      line.status = to;
      const now = nowInManila();

      if (to === 'accepted') {
        line.reviewedBy = user.id;
        line.reviewedAt = now;
        line.reviewNote = extra?.note;
      } else if (to === 'requested') {
        if (!line.requestedAt) line.requestedAt = now;
      } else if (to === 'received') {
        line.receivedAt = now;
      } else if (to === 'incomplete' || to === 'needs_correction') {
        line.flagNote = extra?.note;
      } else if (to === 'not_applicable') {
        line.naReason = extra?.reason;
      }

      line.version += 1;
      logActivity('status_changed', 'line', id, `${user.displayName} updated line "${line.label}" to ${to}`, line.clientId);
      return line;
    },
    async addAdHoc(taskId, line) {
      assertPatch('lines.addAdHoc', line);
      assertReferences(line, store.tasks.find((x) => x.id === taskId)?.clientId);
      assertTask(taskId);
      validate(LineWriteSchema, line);
      const { user } = getCurrentUser();
      const task = store.tasks.find((t) => t.id === taskId);
      if (!task) throw new NotFoundError('Task not found');
      const newLine: TaskLine = {
        id: generateId(),
        orgId: store.org.id,
        taskId,
        clientId: task.clientId,
        label: line.label || 'Ad-hoc requirement',
        required: line.required ?? true,
        copyForm: line.copyForm || 'digital',
        copies: line.copies,
        suppliedBy: line.suppliedBy || 'client',
        printAndBring: line.printAndBring ?? false,
        status: 'not_requested',
        sortOrder: store.taskLines.filter((l) => l.taskId === taskId).length + 1,
        lateDiscovered: true,
        documentIds: [],
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.taskLines.push(newLine);
      return newLine;
    },
    async update(id, input) {
      const { rest: line, expected } = takeVersion(input);
      assertPatch('lines.update', line);
      assertReferences(line, store.taskLines.find((x) => x.id === id)?.clientId);
      assertLine(id);
      rejectIdentityChange(line, store.taskLines.find((x) => x.id === id));
      validate(LineWriteSchema, line);
      const idx = store.taskLines.findIndex((l) => l.id === id);
      if (idx === -1) throw new NotFoundError('Line not found');
      assertVersion(store.taskLines[idx], expected);
      store.taskLines[idx] = { ...store.taskLines[idx], ...line, version: store.taskLines[idx].version + 1 };
      return store.taskLines[idx];
    },
    async reorder(taskId, orderedIds) {
      assertTask(taskId);
      for (const lid of orderedIds) {
        const l = store.taskLines.find((x) => x.id === lid);
        if (!l || l.taskId !== taskId) throw new RuleViolationError('Line does not belong to this task');
      }
      orderedIds.forEach((id, index) => {
        const line = store.taskLines.find((l) => l.id === id && l.taskId === taskId);
        if (line) line.sortOrder = index + 1;
      });
    },
  };

  const followUps: Pick<Repositories['followUps'], 'create' | 'markSent' | 'logResponse' | 'escalate' | 'resolve'> = {
    async create(f) {
      assertPatch('followUps.create', f);
      assertReferences(f, f.clientId);
      assertClient(f.clientId);
      validate(FollowUpCreateSchema, f);
      const { user } = getCurrentUser();
      const newFu: FollowUp = {
        id: generateId(),
        orgId: store.org.id,
        clientId: f.clientId!,
        taskId: f.taskId,
        lineIds: f.lineIds || [],
        contactId: f.contactId,
        channel: f.channel || 'viber',
        language: f.language || 'en',
        expectedBy: f.expectedBy,
        attemptCount: 0,
        status: 'open',
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.followUps.push(newFu);
      return newFu;
    },
    async markSent(id, a) {
      assertFollowUp(id);
      validate(MarkSentWriteSchema, a);
      const { user } = getCurrentUser();
      const fu = store.followUps.find((item) => item.id === id);
      if (!fu) throw new NotFoundError('Follow-up not found');
      fu.status = 'sent';
      fu.expectedBy = a.expectedBy;
      fu.attemptCount += 1;
      fu.channel = a.channel;

      store.followUpAttempts.push({
        id: generateId(),
        orgId: store.org.id,
        followUpId: fu.id,
        attemptNo: fu.attemptCount,
        channel: a.channel,
        sentAt: a.sentAt,
        sentBy: user.id,
        messageSnapshot: a.message,
        expectedBy: a.expectedBy,
        createdAt: a.sentAt,
        createdBy: user.id,
        updatedAt: a.sentAt,
        updatedBy: user.id,
        version: 1,
      });

      // Update lines to requested status
      for (const lineId of fu.lineIds) {
        const line = store.taskLines.find((l) => l.id === lineId);
        if (line && line.status === 'not_requested') {
          line.status = 'requested';
          line.requestedAt = a.sentAt;
        }
      }

      logActivity('follow_up_sent', 'follow_up', id, `Sent follow-up via ${a.channel}`, fu.clientId);
      return queries.followUps.get(id);
    },
    async logResponse(id, r) {
      assertFollowUp(id);
      validate(LogResponseWriteSchema, r);
      const fu = store.followUps.find((item) => item.id === id);
      if (!fu) throw new NotFoundError('Follow-up not found');
      for (const lineId of r.receivedLineIds ?? []) {
        const line = store.taskLines.find((l) => l.id === lineId);
        if (!line) continue;
        assertClient(line.clientId);
        if (line.clientId !== fu.clientId) throw new RuleViolationError('A line of another client cannot be marked received here');
      }
      fu.status = 'answered';
      fu.response = r.text;
      fu.respondedAt = todayInManila() + 'T00:00:00+08:00';

      // Update ticked lines to 'received' status per Spec 11.8
      if (r.receivedLineIds && r.receivedLineIds.length > 0) {
        for (const lineId of r.receivedLineIds) {
          const line = store.taskLines.find((l) => l.id === lineId);
          if (line) {
            line.status = 'received';
            line.receivedAt = todayInManila() + 'T00:00:00+08:00';
            line.receivedVia = r.via || fu.channel;
          }
        }
      }

      // Spec 11.8: Automatic resolve when every line in it is received or not applicable
      const allLines = store.taskLines.filter((l) => fu.lineIds.includes(l.id));
      const allComplete = allLines.every(
        (l) => l.status === 'received' || l.status === 'accepted' || l.status === 'not_applicable'
      );
      if (allComplete && allLines.length > 0) {
        fu.status = 'resolved';
        fu.resolvedAt = todayInManila() + 'T00:00:00+08:00';
        fu.resolvedReason = 'All requested lines received';
      }

      logActivity('response_logged', 'follow_up', id, `Response logged: ${r.text.slice(0, 30)}`, fu.clientId);
      return queries.followUps.get(id);
    },
    async escalate(id, reason) {
      assertFollowUp(id);
      validateReason(reason);
      const fu = store.followUps.find((item) => item.id === id);
      if (!fu) throw new NotFoundError('Follow-up not found');
      fu.status = 'escalated';
      fu.escalatedReason = reason;
      logActivity('escalated', 'follow_up', id, `Escalated: ${reason}`, fu.clientId, reason);
      return queries.followUps.get(id);
    },
    async resolve(id, reason) {
      assertFollowUp(id);
      if (reason !== undefined) validateReason(reason);
      const fu = store.followUps.find((item) => item.id === id);
      if (!fu) throw new NotFoundError('Follow-up not found');
      fu.status = 'resolved';
      fu.resolvedReason = reason || 'Resolved manually';
      fu.resolvedAt = todayInManila() + 'T00:00:00+08:00';
      return queries.followUps.get(id);
    },
  };

  const messages: Pick<Repositories['messages'], 'save'> = {
    async save(m) {
      assertOwner();
      validate(MessageWriteSchema, m);
      const { user } = getCurrentUser();
      const tmpl: MessageTemplate = {
        id: m.id || generateId(),
        orgId: store.org.id,
        name: m.name || 'Template',
        language: m.language || 'en',
        purpose: m.purpose || 'reminder',
        body: m.body || '',
        active: m.active ?? true,
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      const saved = upsertRow(store.messageTemplates, tmpl, m, user.id);
      return saved;
    },
  };

  const offices: Pick<Repositories['offices'], 'save'> = {
    async save(input) {
      requireOwner(actor());
      const { rest: o, expected } = takeVersion(input);
      validate(OfficeWriteSchema, o);
      const { user } = getCurrentUser();
      const existing = o.id ? store.offices.find((item) => item.id === o.id) : undefined;
      if (existing) {
        assertVersion(existing, expected);
        if (o.type) existing.type = o.type;
        if (o.name) existing.name = o.name;
        existing.rdoCode = o.rdoCode;
        existing.address = o.address;
        existing.mapUrl = o.mapUrl;
        existing.hours = o.hours;
        existing.phoneE164 = o.phoneE164;
        existing.tips = o.tips;
        existing.updatedAt = todayInManila() + 'T00:00:00+08:00';
        existing.updatedBy = user.id;
        existing.version += 1;
        return existing;
      }

      const office: Office = {
        id: o.id || generateId(),
        orgId: store.org.id,
        type: o.type || 'rdo',
        name: o.name || 'Office',
        rdoCode: o.rdoCode,
        address: o.address,
        mapUrl: o.mapUrl,
        hours: o.hours,
        phoneE164: o.phoneE164,
        tips: o.tips,
        isSample: false,
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.offices.push(office);
      return office;
    },
  };

  const visits: Pick<Repositories['visits'], 'create' | 'update' | 'addItem' | 'updateItem' | 'removeItem' | 'setPacked' | 'start' | 'recordOutcome' | 'finish' | 'cancel'> = {
    async create(v, items) {
      assertPatch('visits.create', v);
      for (const item of items ?? []) assertPatch('visits.create.item', item);
      for (const item of items ?? []) assertTask(item.taskId);
      validate(VisitWriteSchema, v);
      const { user } = getCurrentUser();
      const newV: Visit = {
        id: generateId(),
        orgId: store.org.id,
        officeId: v.officeId,
        officeType: v.officeType || 'rdo',
        officeName: v.officeName || 'Tax Office',
        rdoCode: v.rdoCode,
        plannedDate: v.plannedDate || todayInManila(),
        arriveBy: v.arriveBy,
        assigneeUserId: v.assigneeUserId || user.id,
        purpose: v.purpose,
        status: 'planned',
        packedLineIds: [],
        packedKitItemIds: [],
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.visits.push(newV);

      if (items) {
        for (const item of items) {
          const task = store.tasks.find((t) => t.id === item.taskId);
          if (task) {
            store.visitItems.push({
              id: generateId(),
              orgId: store.org.id,
              visitId: newV.id,
              taskId: task.id,
              clientId: task.clientId,
              intendedAction: item.action,
              isFirstVisitForTask: true,
              evidenceDocumentIds: [],
              createdAt: todayInManila() + 'T00:00:00+08:00',
              createdBy: user.id,
              updatedAt: todayInManila() + 'T00:00:00+08:00',
              updatedBy: user.id,
              version: 1,
            });
          }
        }
      }

      logActivity('created', 'visit', newV.id, `Planned visit to ${newV.officeName}`);
      return newV;
    },
    async update(id, input) {
      const { rest: v, expected } = takeVersion(input);
      assertPatch('visits.update', v);
      assertVisit(id);
      rejectIdentityChange(v, store.visits.find((x) => x.id === id));
      validate(VisitUpdateSchema, v);
      const visit = store.visits.find((item) => item.id === id);
      if (!visit) throw new NotFoundError('Visit not found');
      assertVersion(visit, expected);
      Object.assign(visit, v);
      visit.version += 1;
      return visit;
    },
    async addItem(visitId, taskId, action) {
      assertVisit(visitId);
      assertTask(taskId);
      validate(VisitAddItemSchema, { action });
      const { user } = getCurrentUser();
      const task = store.tasks.find((t) => t.id === taskId);
      if (!task) throw new NotFoundError('Task not found');
      const vi: VisitItem = {
        id: generateId(),
        orgId: store.org.id,
        visitId,
        taskId,
        clientId: task.clientId,
        intendedAction: action,
        isFirstVisitForTask: true,
        evidenceDocumentIds: [],
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.visitItems.push(vi);
      return vi;
    },
    async updateItem(itemId, input) {
      const { rest: i, expected } = takeVersion(input);
      assertPatch('visits.updateItem', i);
      assertVisitItem(itemId);
      rejectIdentityChange(i, store.visitItems.find((x) => x.id === itemId));
      validate(VisitItemWriteSchema, i);
      const item = store.visitItems.find((vi) => vi.id === itemId);
      if (!item) throw new NotFoundError('Visit item not found');
      assertVersion(item, expected);
      Object.assign(item, i, { version: item.version + 1, updatedAt: nowInManila(), updatedBy: getCurrentUser().user.id });
      return item;
    },
    async removeItem(itemId) {
      assertVisitItem(itemId);
      store.visitItems = store.visitItems.filter((vi) => vi.id !== itemId);
    },
    async setPacked(visitId, ref, packed) {
      assertVisit(visitId);
      const packedLine = ref.lineId ? store.taskLines.find((x) => x.id === ref.lineId) : undefined;
      if (packedLine) assertClient(packedLine.clientId);
      const v = store.visits.find((item) => item.id === visitId);
      if (!v) throw new NotFoundError('Visit not found');
      if (ref.lineId) {
        if (packed) v.packedLineIds = Array.from(new Set([...v.packedLineIds, ref.lineId]));
        else v.packedLineIds = v.packedLineIds.filter((id) => id !== ref.lineId);
      }
      if (ref.kitItemId) {
        if (packed) v.packedKitItemIds = Array.from(new Set([...v.packedKitItemIds, ref.kitItemId]));
        else v.packedKitItemIds = v.packedKitItemIds.filter((id) => id !== ref.kitItemId);
      }
    },
    async start(id, leaveAnywayReason) {
      assertVisit(id);
      if (leaveAnywayReason !== undefined) validateReason(leaveAnywayReason, 'Reason for leaving');
      const v = store.visits.find((item) => item.id === id);
      if (!v) throw new NotFoundError('Visit not found');
      v.status = 'in_progress';
      v.startedAt = todayInManila() + 'T' + new Date().toTimeString().slice(0, 8) + '+08:00';
      v.departureOverrideReason = leaveAnywayReason;
      logActivity('visit_started', 'visit', id, `Started visit to ${v.officeName}`, undefined, leaveAnywayReason);
      return v;
    },
    async recordOutcome(itemId, o) {
      assertVisitItem(itemId);
      validate(OutcomeWriteSchema, o);
      const { user } = getCurrentUser();
      const item = store.visitItems.find((vi) => vi.id === itemId);
      if (!item) throw new NotFoundError('Visit item not found');
      const task = store.tasks.find((t) => t.id === item.taskId);
      if (!task) throw new NotFoundError('Task not found');

      // Lines and documents the outcome names must belong to the item's own client, and flagging a line is a review
      const namedLines = o.affectedLineIds ?? [];
      for (const lineId of namedLines) {
        const line = store.taskLines.find((l) => l.id === lineId);
        if (!line) continue;
        assertClient(line.clientId);
        if (line.clientId !== item.clientId) throw new RuleViolationError('A line of another client cannot be flagged here');
      }
      for (const docId of o.evidenceDocumentIds ?? []) {
        const doc = store.documents.find((d) => d.id === docId);
        if (!doc) continue;
        assertClient(doc.clientId);
        if (doc.clientId !== item.clientId) throw new RuleViolationError('A document of another client cannot be attached here');
      }
      if (namedLines.length > 0 && (o.outcome === 'correction_required' || o.outcome === 'not_accepted')) assertCanReview();

      // Check whether this is the first visit outcome recorded for this task
      const earlierOutcomeCount = store.visitItems.filter(
        (vi) => vi.taskId === task.id && vi.id !== item.id && vi.outcome
      ).length;
      item.isFirstVisitForTask = earlierOutcomeCount === 0;

      item.outcome = o.outcome;
      item.outcomeCause = o.cause;
      item.avoidable = o.avoidable;
      item.outcomeNote = o.note;
      item.windowOrOfficer = o.windowOrOfficer;
      item.nextAction = o.nextAction;
      item.evidenceDocumentIds = o.evidenceDocumentIds || [];
      item.outcomeAt = todayInManila() + 'T' + new Date().toTimeString().slice(0, 8) + '+08:00';
      item.recordedBy = user.id;

      // Apply outcome mapping (Spec 16.6)
      if (o.outcome === 'completed') {
        if (o.evidenceDocumentIds && o.evidenceDocumentIds.length > 0) {
          task.status = 'completed';
          task.completedAt = item.outcomeAt;
        } else {
          task.status = 'awaiting_follow_up';
          task.nextAction = o.nextAction || {
            text: 'Attach evidence document',
            owner: 'operator',
            due: addDaysToDate(todayInManila(), 2),
          };
        }
      } else if (o.outcome === 'submitted_pending') {
        task.status = 'submitted';
        if (!task.submittedAt) task.submittedAt = item.outcomeAt;
        if (o.nextAction) task.nextAction = o.nextAction;
      } else if (o.outcome === 'paid_proof_pending') {
        task.status = 'awaiting_follow_up';
        task.nextAction = o.nextAction || {
          text: 'Attach payment proof',
          owner: 'operator',
          due: addDaysToDate(todayInManila(), 2),
        };
      } else if (o.outcome === 'more_documents_requested') {
        task.status = 'in_preparation';
        if (o.requestedDocuments && o.requestedDocuments.length > 0) {
          for (const docName of o.requestedDocuments) {
            store.taskLines.push({
              id: generateId(),
              orgId: store.org.id,
              taskId: task.id,
              clientId: task.clientId,
              label: docName,
              required: true,
              copyForm: 'photocopy',
              suppliedBy: 'client',
              printAndBring: true,
              status: 'not_requested',
              sortOrder: store.taskLines.filter((l) => l.taskId === task.id).length + 1,
              lateDiscovered: true,
              documentIds: [],
              createdAt: todayInManila() + 'T00:00:00+08:00',
              createdBy: user.id,
              updatedAt: todayInManila() + 'T00:00:00+08:00',
              updatedBy: user.id,
              version: 1,
            });
          }
        }
        if (o.nextAction) task.nextAction = o.nextAction;
      } else if (o.outcome === 'correction_required') {
        task.status = 'in_preparation';
        if (o.affectedLineIds && o.affectedLineIds.length > 0) {
          for (const lineId of o.affectedLineIds) {
            const line = store.taskLines.find((l) => l.id === lineId);
            if (line) {
              line.status = 'needs_correction';
              if (o.note) line.flagNote = o.note;
            }
          }
        }
        if (o.nextAction) task.nextAction = o.nextAction;
      } else if (o.outcome === 'not_accepted') {
        task.status = 'in_preparation';
        if (o.affectedLineIds && o.affectedLineIds.length > 0) {
          for (const lineId of o.affectedLineIds) {
            const line = store.taskLines.find((l) => l.id === lineId);
            if (line) {
              line.status = 'needs_correction';
              if (o.note) line.flagNote = o.note;
            }
          }
        }
        if (o.nextAction) task.nextAction = o.nextAction;
      } else if (o.outcome === 'follow_up_required') {
        task.status = 'awaiting_follow_up';
        if (o.nextAction) task.nextAction = o.nextAction;
      }

      logActivity('outcome_recorded', 'visit_item', itemId, `Recorded outcome: ${o.outcome}`, task.clientId);
      return item;
    },
    async finish(id, f) {
      assertVisit(id);
      validate(FinishVisitSchema, f);
      const v = store.visits.find((item) => item.id === id);
      if (!v) throw new NotFoundError('Visit not found');
      if (!canFinishVisit(store.visitItems.filter((i) => i.visitId === id))) {
        throw new RuleViolationError('Every item needs a saved outcome before the visit can be finished');
      }
      v.status = 'done';
      v.finishedAt = f.finishedAt;
      v.costs = f.costs;
      logActivity('visit_finished', 'visit', id, `Finished visit to ${v.officeName}`);
      return v;
    },
    async cancel(id, reason) {
      assertVisit(id);
      // A visit that holds items for clients the helper is not assigned to is the owner's to cancel
      const heldClients = store.visitItems.filter((i) => i.visitId === id).map((i) => i.clientId);
      if (!canCancelVisit(actor(), heldClients)) {
        throw new ForbiddenError('This visit holds items for clients you are not assigned to. Ask the owner to cancel it.');
      }
      validateReason(reason);
      const v = store.visits.find((item) => item.id === id);
      if (v) {
        v.status = 'cancelled';
        v.cancelledReason = reason;
        logActivity('visit_cancelled', 'visit', id, `Cancelled visit: ${reason}`, undefined, reason);
      }
    },
  };

  const visitKit: Pick<Repositories['visitKit'], 'save'> = {
    async save(i) {
      assertOwner();
      validate(VisitKitWriteSchema, i);
      const item: VisitKitItem = {
        id: i.id || generateId(),
        orgId: store.org.id,
        label: i.label || 'Item',
        note: i.note,
        active: i.active ?? true,
        sortOrder: i.sortOrder || 1,
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: 'user',
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: 'user',
        version: 1,
      };
      const saved = upsertRow(store.visitKit, item, i, getCurrentUser().user.id);
      return saved;
    },
  };

  const payments: Pick<Repositories['payments'], 'save' | 'remove'> = {
    async save(input) {
      const { rest: p, expected } = takeVersion(input);
      assertPatch('payments.save', p);
      const storedPayment = p.id ? store.payments.find((x) => x.id === p.id) : undefined;
      assertReferences(p, storedPayment?.clientId ?? p.clientId);
      assertRecordWrite(store.payments, p.id, p.clientId);
      rejectIdentityChange(p, storedPayment);
      validate(PaymentWriteSchema, p);
      const { user } = getCurrentUser();

      const existing = p.id ? store.payments.find((item) => item.id === p.id) : undefined;
      if (existing) {
        assertVersion(existing, expected);
        if (p.amount !== undefined) existing.amount = p.amount;
        if (p.paidOn) existing.paidOn = p.paidOn;
        if (p.channel) existing.channel = p.channel;
        existing.provider = p.provider;
        existing.referenceNo = p.referenceNo;
        if (p.paidBy) existing.paidBy = p.paidBy;
        existing.reimbursement = p.reimbursement;
        if (p.proofDocumentIds) existing.proofDocumentIds = p.proofDocumentIds;
        existing.note = p.note;
        existing.updatedAt = todayInManila() + 'T00:00:00+08:00';
        existing.updatedBy = user.id;
        existing.version += 1;

        if (existing.proofDocumentIds.length > 0 && existing.taskId) {
          const task = store.tasks.find((t) => t.id === existing.taskId);
          if (task && task.nextAction?.text?.toLowerCase().includes('proof')) {
            delete task.nextAction;
          }
        }

        return existing;
      }

      const payment: Payment = {
        id: p.id || generateId(),
        orgId: store.org.id,
        clientId: p.clientId!,
        taskId: p.taskId!,
        amount: p.amount || 0,
        paidOn: p.paidOn || todayInManila(),
        channel: p.channel || 'aab_otc',
        provider: p.provider,
        referenceNo: p.referenceNo,
        paidBy: p.paidBy || 'operator',
        reimbursement: p.reimbursement,
        proofDocumentIds: p.proofDocumentIds || [],
        note: p.note,
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.payments.push(payment);

      // Section 11.12: Recording payment with proof clears next action "Attach payment proof"
      if (payment.proofDocumentIds.length > 0 && payment.taskId) {
        const task = store.tasks.find((t) => t.id === payment.taskId);
        if (task && task.nextAction?.text?.toLowerCase().includes('proof')) {
          delete task.nextAction;
        }
      }

      logActivity(
        'created',
        'payment',
        payment.id,
        `Recorded payment of ₱${(payment.amount / 100).toFixed(2)}`,
        payment.clientId
      );
      return payment;
    },
    async remove(id, reason) {
      assertPayment(id);
      validateReason(reason);
      const p = store.payments.find((item) => item.id === id);
      if (p) {
        p.deletedAt = todayInManila() + 'T00:00:00+08:00';
        p.deletedReason = reason;
        logActivity('deleted', 'payment', id, `Removed payment record: ${reason}`, p.clientId);
      }
    },
  };

  const notes: Pick<Repositories['notes'], 'save'> = {
    async save(input) {
      const { rest: n, expected } = takeVersion(input);
      assertPatch('notes.save', n);
      const stored = n.id ? store.notes.find((x) => x.id === n.id) : undefined;
      if (stored) assertNoteTarget(stored.entity, stored.entityId);
      assertNoteTarget(n.entity || stored?.entity || 'task', (n.entityId ?? stored?.entityId) as ID);
      validate(NoteWriteSchema, n);
      const { user } = getCurrentUser();
      if (stored) {
        // An id names one note on one record: it cannot be reused for a note on another entity
        if ((n.entity ?? stored.entity) !== stored.entity || (n.entityId ?? stored.entityId) !== stored.entityId) {
          throw new RuleViolationError('This note id belongs to a note on another record');
        }
        assertVersion(stored, expected);
        stored.body = n.body ?? stored.body;
        if (n.pinned !== undefined) stored.pinned = n.pinned;
        stored.editedAt = nowInManila();
        stored.updatedAt = nowInManila();
        stored.updatedBy = user.id;
        stored.version += 1;
        return stored;
      }
      const note: Note = {
        id: n.id || generateId(),
        orgId: store.org.id,
        entity: n.entity || 'task',
        entityId: n.entityId!,
        body: n.body || '',
        pinned: n.pinned ?? false,
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.notes.push(note);
      return note;
    },
  };

  const savedViews: Pick<Repositories['savedViews'], 'save' | 'remove'> = {
    async save(input) {
      const { rest: v, expected } = takeVersion(input);
      const { user } = getCurrentUser();
      const stored = v.id ? store.savedViews.find((x) => x.id === v.id) : undefined;
      if (stored) {
        // Views are the signed-in person's own; shared views of other people are read-only
        if (stored.userId !== user.id) throw new ForbiddenError('You can only change your own saved views');
        assertVersion(stored, expected);
        const { id: _id, userId: _userId, ...changes } = v;
        Object.assign(stored, Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)));
        stored.updatedAt = nowInManila();
        stored.updatedBy = user.id;
        stored.version += 1;
        return stored;
      }
      const sv: SavedView = {
        id: v.id || generateId(),
        orgId: store.org.id,
        userId: user.id,
        page: v.page || 'tasks',
        name: v.name || 'View',
        query: v.query || '',
        shared: v.shared ?? false,
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.savedViews.push(sv);
      return sv;
    },
    async remove(id) {
      store.savedViews = store.savedViews.filter((v) => v.id !== id);
    },
  };

  const notifications: Pick<Repositories['notifications'], 'markRead'> = {
    async markRead(ids) {
      const now = todayInManila() + 'T00:00:00+08:00';
      if (ids === 'all') {
        store.notifications.forEach((n) => {
          n.readAt = now;
        });
      } else {
        store.notifications.forEach((n) => {
          if (ids.includes(n.id)) n.readAt = now;
        });
      }
    },
  };

  const baseline: Pick<Repositories['baseline'], 'save'> = {
    async save(input) {
      assertOwner();
      const { rest: b, expected } = takeVersion(input);
      validate(BaselineWriteSchema, b);
      if (store.baseline) assertVersion(store.baseline, expected);
      const { user } = getCurrentUser();
      store.baseline = {
        id: store.baseline?.id || generateId(),
        orgId: store.org.id,
        periodStart: b.periodStart || '2026-01-01',
        periodEnd: b.periodEnd || '2026-06-30',
        tripsPerMonth: b.tripsPerMonth ?? 12,
        repeatTripsPerMonth: b.repeatTripsPerMonth ?? 4,
        followUpsPerWeek: b.followUpsPerWeek ?? 10,
        hoursFindingPerWeek: b.hoursFindingPerWeek ?? 6,
        lateFilingsPerQuarter: b.lateFilingsPerQuarter ?? 1,
        confidence: b.confidence ?? 3,
        note: b.note ?? '',
        createdAt: store.baseline?.createdAt || (todayInManila() + 'T00:00:00+08:00'),
        createdBy: store.baseline?.createdBy || user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: (store.baseline?.version ?? 0) + 1,
      };
      return store.baseline;
    },
  };

  const pulses: Pick<Repositories['pulses'], 'save'> = {
    async save(p) {
      assertOwner();
      validate(PulseWriteSchema, p);
      const pulse: Pulse = {
        id: generateId(),
        orgId: store.org.id,
        month: p.month || todayInManila().slice(0, 7),
        hoursFindingLastWeek: p.hoursFindingLastWeek,
        confidence: p.confidence || 4,
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: 'user',
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: 'user',
        version: 1,
      };
      store.pulses.push(pulse);
      return pulse;
    },
  };

  /** Spec 9.9 display name for a file attached to a client and, usually, a task. */
  function nameForDocument(
    meta: { clientId: ID; taskId?: ID; kind: DocumentKind },
    versionNo: number,
    originalName: string,
    mimeType?: string,
  ): string {
    const client = store.clients.find((c) => c.id === meta.clientId);
    const task = meta.taskId ? store.tasks.find((t) => t.id === meta.taskId) : undefined;
    const template = task?.templateId ? store.templates.find((t) => t.id === task.templateId) : undefined;
    return documentDisplayName({
      clientCode: client?.code ?? 'CLIENT',
      templateCode: template?.code,
      period: task?.period ?? task?.transactionDate ?? todayInManila(),
      kind: meta.kind,
      versionNo,
      originalName,
      mimeType,
    });
  }

  const fileStore = (): FileStore => {
    if (!ctx.files) throw new Error('This command needs a file store');
    return ctx.files;
  };

  const documents: Pick<Repositories['documents'], 'upload' | 'replace' | 'update' | 'remove' | 'getUrl'> = {
    async upload(meta, file, thumb, info) {
      assertPatch('documents.upload', meta);
      assertReferences(meta, meta.clientId);
      assertClient(meta.clientId);
      validate(DocumentMetaSchema, meta);
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      const docId = generateId();
      const originalName = info?.originalName || 'file.pdf';
      const where = { orgId: store.org.id, clientId: meta.clientId, taskId: meta.taskId, documentId: docId, versionNo: 1 };
      const fileKey = fileStore().keyFor({ ...where, ext: extensionOf(originalName, file.type) });
      const thumbKey = thumb ? fileStore().keyFor({ ...where, ext: 'jpg', thumb: true }) : undefined;
      await fileStore().put(fileKey, file);
      if (thumb && thumbKey) await fileStore().put(thumbKey, thumb);
      const doc: DocumentFile = {
        id: docId,
        orgId: store.org.id,
        clientId: meta.clientId,
        taskId: meta.taskId,
        lineId: meta.lineId,
        visitItemId: meta.visitItemId,
        paymentId: meta.paymentId,
        authorizationId: meta.authorizationId,
        kind: meta.kind,
        displayName: nameForDocument(meta, 1, originalName, file.type),
        originalName,
        mimeType: file.type || 'application/pdf',
        sizeBytes: file.size,
        originalSizeBytes: info?.originalSizeBytes || file.size,
        compressed: file.size < (info?.originalSizeBytes || file.size),
        pageCount: info?.pageCount,
        sha256: info?.sha256 || 'fake-hash-' + Date.now(),
        storageKey: fileKey,
        thumbnailKey: thumbKey,
        versionNo: 1,
        source: meta.source,
        createdAt: now,
        createdBy: user.id,
        updatedAt: now,
        updatedBy: user.id,
        version: 1,
      };
      store.documents.push(doc);

      if (meta.lineId) {
        const line = store.taskLines.find((l) => l.id === meta.lineId);
        if (line) {
          line.documentIds.push(doc.id);
          // Only move the line when the transition is allowed: an accepted line stays accepted, a received one stays received
          if (line.status !== 'received' && canTransitionLine(line.status, 'received')) {
            line.status = 'received';
            line.receivedAt = now;
          }
        }
      }

      logActivity('file_uploaded', 'document', doc.id, `Uploaded ${doc.displayName}`, doc.clientId);
      return doc;
    },

    async replace(id, file, thumb, info) {
      assertDocument(id);
      const old = store.documents.find((d) => d.id === id);
      if (!old) throw new NotFoundError('Document not found');
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      const newId = generateId();
      const originalName = info?.originalName || old.originalName;
      const where = { orgId: store.org.id, clientId: old.clientId, taskId: old.taskId, documentId: newId, versionNo: old.versionNo + 1 };
      const fileKey = fileStore().keyFor({ ...where, ext: extensionOf(originalName, file.type) });
      const thumbKey = thumb ? fileStore().keyFor({ ...where, ext: 'jpg', thumb: true }) : undefined;
      await fileStore().put(fileKey, file);
      if (thumb && thumbKey) await fileStore().put(thumbKey, thumb);
      const next: DocumentFile = {
        ...old,
        id: newId,
        displayName: nameForDocument(old, old.versionNo + 1, originalName, file.type),
        originalName,
        mimeType: file.type || old.mimeType,
        sizeBytes: file.size,
        originalSizeBytes: info?.originalSizeBytes || file.size,
        compressed: file.size < (info?.originalSizeBytes || file.size),
        pageCount: undefined,
        sha256: info?.sha256 || 'fake-hash-' + Date.now(),
        storageKey: fileKey,
        thumbnailKey: thumbKey,
        versionNo: old.versionNo + 1,
        replacesId: old.id,
        deletedAt: undefined,
        deletedReason: undefined,
        createdAt: now,
        createdBy: user.id,
        updatedAt: now,
        updatedBy: user.id,
        version: 1,
      };
      store.documents.push(next);
      if (next.lineId) {
        const line = store.taskLines.find((l) => l.id === next.lineId);
        if (line) line.documentIds.push(next.id);
      }
      logActivity('file_replaced', 'document', next.id, `Replaced ${old.displayName} with ${next.displayName}`, next.clientId);
      return next;
    },

    async update(id, input) {
      const { rest: d, expected } = takeVersion(input);
      assertPatch('documents.update', d);
      assertReferences(d, store.documents.find((x) => x.id === id)?.clientId);
      assertDocument(id);
      rejectIdentityChange(d, store.documents.find((x) => x.id === id));
      validate(DocumentUpdateSchema, d);
      const doc = store.documents.find((item) => item.id === id);
      if (!doc) throw new NotFoundError('Document not found');
      assertVersion(doc, expected);
      Object.assign(doc, d, { version: doc.version + 1, updatedAt: nowInManila(), updatedBy: getCurrentUser().user.id });
      logActivity('updated', 'document', id, `Updated ${doc.displayName}`, doc.clientId);
      return doc;
    },

    async remove(id, reason) {
      assertDocument(id);
      validateReason(reason);
      const doc = store.documents.find((d) => d.id === id);
      if (doc) {
        doc.deletedAt = todayInManila() + 'T00:00:00+08:00';
        doc.deletedReason = reason;
        doc.version += 1;
        logActivity('deleted', 'document', id, `Removed ${doc.displayName}: ${reason}`, doc.clientId, reason);
      }
    },

    async getUrl(id, purpose) {
      assertDocument(id);
      const doc = store.documents.find((d) => d.id === id);
      if (!doc || doc.deletedAt) throw new NotFoundError('Document not found');
      logActivity(purpose === 'download' ? 'file_downloaded' : 'file_viewed', 'document', id, `${purpose} document ${doc.displayName}`, doc.clientId);
      return fileStore().urlFor(doc, purpose);
    },
  };

  return { assertCanSetStatus, rejectIdentityChange, assertRecordWrite, assertCanReview, assertPatch, assertReferences, upsertRow, logActivity, memberships, settings, prefs, clients, contacts, authorizations, templates, deadlineMoves, holidays, tasks, lines, followUps, messages, offices, visits, visitKit, payments, notes, savedViews, notifications, baseline, pulses, queries , documents };
}

export type Commands = ReturnType<typeof createCommands>;
