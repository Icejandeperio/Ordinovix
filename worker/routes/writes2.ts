/**
 * Write routes, part 2 (BACKEND_PLAN section 4): follow-ups, offices, visits (with outcomes), payments, notes, saved views,
 * notifications, baseline and pulses, settings and preferences, memberships, and the client import. Same guarantees as part 1
 * (writes.ts): the shared command, one atomic batch with its activity row and the idempotency record, an Idempotency-Key, an
 * If-Match version on updates, strict bodies. Mounted behind requireSession, requireMembership and requireActive; the owner-only
 * groups (settings, memberships, import) check the role in middleware.
 */
import { Hono } from 'hono';
import { ValidationError } from '@/domain/errors';
import { ifMatchVersion, runWrite } from '../db/persist';
import type { AppEnv } from '../env';
import { readBody, text } from '../lib/body';
import { encryptTin, hashTin, maskTin, normalizeTin } from '../lib/tin';
import { ownerOnly } from '../middleware/auth';

export const writeRoutes2 = new Hono<AppEnv>();

const FOLLOW_UP = ['clientId', 'taskId', 'contactId', 'channel', 'language', 'templateId', 'expectedBy', 'lineIds'] as const;
const OFFICE = ['type', 'name', 'rdoCode', 'address', 'mapUrl', 'hours', 'phoneE164', 'tips'] as const;
const VISIT = ['officeId', 'officeType', 'officeName', 'rdoCode', 'plannedDate', 'arriveBy', 'assigneeUserId', 'purpose'] as const;
const VISIT_UPDATE = ['plannedDate', 'arriveBy', 'assigneeUserId', 'purpose', 'officeId'] as const;
const VISIT_ITEM_UPDATE = ['intendedAction', 'questions'] as const;
const OUTCOME = ['outcome', 'cause', 'avoidable', 'note', 'windowOrOfficer', 'nextAction', 'evidenceDocumentIds', 'requestedDocuments', 'affectedLineIds'] as const;
const KIT = ['label', 'note', 'active', 'sortOrder'] as const;
const PAYMENT = ['clientId', 'taskId', 'amount', 'paidOn', 'channel', 'provider', 'referenceNo', 'paidBy', 'reimbursement', 'proofDocumentIds', 'note'] as const;
const NOTE = ['entity', 'entityId', 'body', 'pinned'] as const;
const SAVED_VIEW = ['page', 'name', 'query', 'shared'] as const;
const BASELINE = ['periodStart', 'periodEnd', 'tripsPerMonth', 'repeatTripsPerMonth', 'followUpsPerWeek', 'hoursFindingPerWeek', 'lateFilingsPerQuarter', 'confidence', 'note'] as const;
const PULSE = ['month', 'hoursFindingLastWeek', 'confidence', 'note'] as const;
const SETTINGS = ['practiceName', 'operatorDisplayName', 'mobileE164', 'accreditation', 'dueSoonDays', 'followUpWaitDays', 'authWarnDays', 'helpersCanAccept', 'idleLockMinutes', 'quietHours', 'digestTime', 'paperSize', 'weekStartsOn', 'retentionYears', 'supportContact', 'onboarding'] as const;
const PREFS = ['theme', 'density', 'textScale', 'reduceMotion', 'dateOrder', 'privacyModeOnStart', 'todayScope', 'pushTypes', 'tableColumns'] as const;
const MEMBERSHIP_INVITE = ['email', 'role', 'clientIds', 'name', 'note'] as const;
const MEMBERSHIP_UPDATE = ['role', 'clientIds', 'active', 'name'] as const;

const reason = (b: Record<string, any>) => text(b.reason, 'reason');
const REASON = ['reason'] as const;

// ---- follow-ups -------------------------------------------------------------------------------------------------
writeRoutes2.post('/follow-ups', async (c) => {
  const body = await readBody(c, FOLLOW_UP);
  return runWrite(c, { status: 201, run: (cmd) => cmd.followUps.create(body) });
});
writeRoutes2.post('/follow-ups/:id/sent', async (c) => {
  const body = await readBody(c, ['channel', 'sentAt', 'expectedBy', 'message']);
  return runWrite(c, { run: (cmd) => cmd.followUps.markSent(c.req.param('id'), body as never) });
});
writeRoutes2.post('/follow-ups/:id/response', async (c) => {
  const body = await readBody(c, ['text', 'receivedLineIds', 'via']);
  return runWrite(c, { run: (cmd) => cmd.followUps.logResponse(c.req.param('id'), { ...body, receivedLineIds: body.receivedLineIds ?? [] } as never) });
});
writeRoutes2.post('/follow-ups/:id/escalate', async (c) => {
  const r = reason(await readBody(c, REASON));
  return runWrite(c, { run: (cmd) => cmd.followUps.escalate(c.req.param('id'), r) });
});
writeRoutes2.post('/follow-ups/:id/resolve', async (c) => {
  const body = await readBody(c, REASON, { optional: true });
  return runWrite(c, { run: (cmd) => cmd.followUps.resolve(c.req.param('id'), body.reason) });
});

// ---- offices, visits --------------------------------------------------------------------------------------------
writeRoutes2.post('/offices', async (c) => {
  const body = await readBody(c, OFFICE);
  return runWrite(c, { status: 201, run: (cmd) => cmd.offices.save(body) });
});
writeRoutes2.put('/offices/:id', async (c) => {
  const body = await readBody(c, OFFICE);
  return runWrite(c, { run: (cmd) => cmd.offices.save({ ...body, id: c.req.param('id'), version: ifMatchVersion(c) }) });
});

writeRoutes2.post('/visits', async (c) => {
  const { items, ...visit } = await readBody(c, [...VISIT, 'items']);
  return runWrite(c, { status: 201, run: (cmd) => cmd.visits.create(visit, items ?? []) });
});
writeRoutes2.patch('/visits/:id', async (c) => {
  const body = await readBody(c, VISIT_UPDATE);
  return runWrite(c, { run: (cmd) => cmd.visits.update(c.req.param('id'), { ...body, version: ifMatchVersion(c) }) });
});
writeRoutes2.post('/visits/:id/items', async (c) => {
  const body = await readBody(c, ['taskId', 'action']);
  return runWrite(c, { status: 201, run: (cmd) => cmd.visits.addItem(c.req.param('id'), text(body.taskId, 'taskId'), text(body.action, 'action') as never) });
});
writeRoutes2.patch('/visits/:id/items/:itemId', async (c) => {
  const body = await readBody(c, VISIT_ITEM_UPDATE);
  return runWrite(c, { run: (cmd) => cmd.visits.updateItem(c.req.param('itemId'), { ...body, version: ifMatchVersion(c) }) });
});
writeRoutes2.delete('/visits/:id/items/:itemId', async (c) => runWrite(c, { run: (cmd) => cmd.visits.removeItem(c.req.param('itemId')) }));
writeRoutes2.put('/visits/:id/packed', async (c) => {
  const body = await readBody(c, ['lineId', 'kitItemId', 'packed']);
  if (typeof body.packed !== 'boolean') throw new ValidationError({ packed: ['packed must be true or false'] });
  return runWrite(c, { run: (cmd) => cmd.visits.setPacked(c.req.param('id'), { lineId: body.lineId, kitItemId: body.kitItemId }, body.packed) });
});
writeRoutes2.post('/visits/:id/start', async (c) => {
  const body = await readBody(c, ['leaveAnywayReason'], { optional: true });
  return runWrite(c, { run: (cmd) => cmd.visits.start(c.req.param('id'), body.leaveAnywayReason) });
});
writeRoutes2.post('/visits/:id/items/:itemId/outcome', async (c) => {
  const body = await readBody(c, OUTCOME);
  return runWrite(c, { run: (cmd) => cmd.visits.recordOutcome(c.req.param('itemId'), { ...body, evidenceDocumentIds: body.evidenceDocumentIds ?? [] } as never) });
});
writeRoutes2.post('/visits/:id/finish', async (c) => {
  const body = await readBody(c, ['finishedAt', 'costs']);
  return runWrite(c, { run: (cmd) => cmd.visits.finish(c.req.param('id'), { finishedAt: text(body.finishedAt, 'finishedAt'), costs: body.costs }) });
});
writeRoutes2.post('/visits/:id/cancel', async (c) => {
  const r = reason(await readBody(c, REASON));
  return runWrite(c, { run: (cmd) => cmd.visits.cancel(c.req.param('id'), r) });
});

writeRoutes2.post('/visit-kit', async (c) => {
  const body = await readBody(c, KIT);
  return runWrite(c, { status: 201, run: (cmd) => cmd.visitKit.save(body) });
});
writeRoutes2.put('/visit-kit/:id', async (c) => {
  const body = await readBody(c, KIT);
  return runWrite(c, { run: (cmd) => cmd.visitKit.save({ ...body, id: c.req.param('id'), version: ifMatchVersion(c) }) });
});

// ---- payments, notes, saved views, notifications ----------------------------------------------------------------
writeRoutes2.post('/payments', async (c) => {
  const body = await readBody(c, PAYMENT);
  return runWrite(c, { status: 201, run: (cmd) => cmd.payments.save(body) });
});
writeRoutes2.patch('/payments/:id', async (c) => {
  const body = await readBody(c, PAYMENT);
  return runWrite(c, { run: (cmd) => cmd.payments.save({ ...body, id: c.req.param('id'), version: ifMatchVersion(c) }) });
});
writeRoutes2.delete('/payments/:id', async (c) => {
  const r = reason(await readBody(c, REASON));
  return runWrite(c, { run: (cmd) => cmd.payments.remove(c.req.param('id'), r) });
});

writeRoutes2.post('/notes', async (c) => {
  const body = await readBody(c, NOTE);
  return runWrite(c, { status: 201, run: (cmd) => cmd.notes.save(body) });
});
writeRoutes2.patch('/notes/:id', async (c) => {
  const body = await readBody(c, NOTE);
  return runWrite(c, { run: (cmd) => cmd.notes.save({ ...body, id: c.req.param('id'), version: ifMatchVersion(c) }) });
});

writeRoutes2.post('/saved-views', async (c) => {
  const body = await readBody(c, SAVED_VIEW);
  return runWrite(c, { status: 201, run: (cmd) => cmd.savedViews.save(body) });
});
writeRoutes2.put('/saved-views/:id', async (c) => {
  const body = await readBody(c, SAVED_VIEW);
  return runWrite(c, { run: (cmd) => cmd.savedViews.save({ ...body, id: c.req.param('id'), version: ifMatchVersion(c) }) });
});
writeRoutes2.delete('/saved-views/:id', async (c) => runWrite(c, { run: (cmd) => cmd.savedViews.remove(c.req.param('id')) }));

writeRoutes2.post('/notifications/read', async (c) => {
  const body = await readBody(c, ['ids', 'all']);
  const ids = body.all === true ? 'all' : body.ids;
  if (ids !== 'all' && !Array.isArray(ids)) throw new ValidationError({ ids: ['Send ids (a list) or all: true'] });
  return runWrite(c, { run: (cmd) => cmd.notifications.markRead(ids) });
});

// ---- baseline, pulses -------------------------------------------------------------------------------------------
writeRoutes2.put('/baseline', async (c) => {
  const body = await readBody(c, BASELINE);
  // the first baseline has no version to name; once one exists, an update must carry it
  const exists = await c.env.DB.prepare('SELECT version FROM baselines WHERE org_id = ?').bind(c.get('actor').orgId).first<{ version: number }>();
  const version = exists ? ifMatchVersion(c) : undefined;
  return runWrite(c, { run: (cmd) => cmd.baseline.save({ ...body, ...(version !== undefined ? { version } : {}) }) });
});
writeRoutes2.post('/pulses', async (c) => {
  const body = await readBody(c, PULSE);
  return runWrite(c, { status: 201, run: (cmd) => cmd.pulses.save(body) });
});

// ---- settings and preferences -----------------------------------------------------------------------------------
writeRoutes2.put('/settings', ownerOnly, async (c) => {
  const body = await readBody(c, SETTINGS);
  return runWrite(c, { run: (cmd) => cmd.settings.save({ ...body, version: ifMatchVersion(c) }) });
});
writeRoutes2.put('/prefs', async (c) => {
  const body = await readBody(c, PREFS);
  return runWrite(c, { run: (cmd) => cmd.prefs.save(body) });
});

// ---- memberships (owner only) -----------------------------------------------------------------------------------
writeRoutes2.post('/memberships', ownerOnly, async (c) => {
  const body = await readBody(c, MEMBERSHIP_INVITE);
  return runWrite(c, { status: 201, run: (cmd) => cmd.memberships.invite({ ...body, clientIds: body.clientIds ?? [] } as never) });
});
writeRoutes2.patch('/memberships/:id', ownerOnly, async (c) => {
  const body = await readBody(c, MEMBERSHIP_UPDATE);
  return runWrite(c, { run: (cmd) => cmd.memberships.update(c.req.param('id'), { ...body, version: ifMatchVersion(c) }) });
});
writeRoutes2.post('/memberships/:id/revoke', ownerOnly, async (c) => {
  const id = c.req.param('id');
  return runWrite(c, {
    run: (cmd) => cmd.memberships.revoke(id),
    // a revoked person is signed out everywhere, in the same batch
    extra: (_result, d1) => [
      d1
        .prepare('DELETE FROM session WHERE user_id IN (SELECT COALESCE(u.auth_user_id, u.id) FROM users u JOIN memberships m ON m.user_id = u.id WHERE m.id = ? AND m.org_id = ?)')
        .bind(id, c.get('actor').orgId),
    ],
  });
});

// ---- client import (owner only; the commit is one batch, the undo soft-deletes the batch's clients) -----------------------
writeRoutes2.post('/clients/import/preview', ownerOnly, async (c) => {
  const body = await readBody(c, ['rows', 'mapping']);
  if (!Array.isArray(body.rows) || typeof body.mapping !== 'object' || body.mapping === null) throw new ValidationError({ rows: ['Send rows (a list) and mapping (column to field)'] });
  // the preview returns the caller's own upload (TINs included) for the commit to send back; nothing is stored or logged here
  return runWrite(c, { idempotent: false, scrub: false, run: (cmd) => cmd.clients.importPreview(body.rows, body.mapping) });
});
writeRoutes2.post('/clients/import/commit', ownerOnly, async (c) => {
  const body = await readBody(c, ['preview']);
  if (!body.preview || !Array.isArray(body.preview.validRows)) throw new ValidationError({ preview: ['Send the preview you got from /clients/import/preview'] });
  // TINs in the file never reach the database in the clear: they are normalised, masked, encrypted and hashed here, in the same batch
  const rows: Array<Record<string, any>> = body.preview.validRows.map((r: Record<string, any>) => ({ ...r }));
  const sealed = new Map<number, { ciphertext: string; hash: string }>();
  for (const [i, row] of rows.entries()) {
    const raw = row.tinFull ?? undefined;
    delete row.tinFull;
    if (raw === undefined) continue;
    const tin = normalizeTin(String(raw));
    if (!tin) throw new ValidationError({ [`validRows.${i}.tin`]: ['This TIN is not valid, like 123-456-789-00000'] });
    row.tinMasked = maskTin(tin);
    row.hasTin = true;
    sealed.set(i, { ciphertext: await encryptTin(c.env.TIN_ENCRYPTION_KEY, tin), hash: await hashTin(c.env.TIN_ENCRYPTION_KEY, tin) });
  }
  return runWrite(c, {
    status: 201,
    run: (cmd) => cmd.clients.importCommit({ ...body.preview, validRows: rows }),
    extra: (result, d1) => [...sealed].map(([i, s]) => d1.prepare('UPDATE clients SET tin_encrypted = ?, tin_hash = ? WHERE id = ?').bind(s.ciphertext, s.hash, result.created[i])),
  });
});
writeRoutes2.post('/clients/import/:batchId/undo', ownerOnly, async (c) => runWrite(c, { run: (cmd) => cmd.clients.importUndo(c.req.param('batchId')) }));
