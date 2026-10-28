/**
 * Write routes, part 1 (BACKEND_PLAN section 4): clients, contacts, authorizations, templates, deadline moves, holidays,
 * messages, tasks and lines. Every route runs the shared command (src/data/commands.ts) through runWrite: the same rules and
 * permission checks as the mock, one atomic batch, an Idempotency-Key, and an If-Match version on updates.
 * Mounted behind requireSession, requireMembership and requireActive.
 */
import { Hono } from 'hono';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { ifMatchVersion, runWrite } from '../db/persist';
import type { AppEnv } from '../env';
import { readBody, text } from '../lib/body';
import { decryptTin, encryptTin, hashTin, maskTin, normalizeTin } from '../lib/tin';

export const writeRoutes = new Hono<AppEnv>();

// ---- writable fields per entity: the API contract (everything else is refused with 422) -------------------------------
const CLIENT = ['code', 'displayName', 'registeredName', 'entityType', 'tinFull', 'tinMasked', 'hasTin', 'rdoCode', 'rdoOfficeId', 'vatStatus', 'sizeClass', 'filingChannel', 'efpsGroup', 'orusEnrolled', 'accessHolder', 'usesInvoicingSoftware', 'fiscalYearEndMonth', 'preferredLanguage', 'deliveryPreference', 'address', 'assignedUserIds', 'tags', 'notes'] as const;
const CONTACT = ['clientId', 'name', 'title', 'role', 'phoneE164', 'email', 'preferredChannel', 'language', 'isSignatory', 'notes'] as const;
const AUTHORIZATION = ['clientId', 'type', 'scope', 'granteeUserId', 'issuedOn', 'validUntil', 'notarized', 'documentId', 'notes'] as const;
const TEMPLATE = ['code', 'name', 'kind', 'frequency', 'appliesTo', 'officeAction', 'defaultOfficeType', 'defaultAction', 'paymentExpected', 'defaultDue', 'description', 'sourceRef', 'sourceUrl', 'active', 'lines'] as const;
const VERIFY = ['sourceRef', 'sourceUrl', 'verifiedOn', 'note'] as const;
const DEADLINE_MOVE = ['templateId', 'period', 'newDueDate', 'sourceRef', 'sourceUrl', 'note', 'applyToOpenTasks'] as const;
const HOLIDAY = ['date', 'name', 'type', 'sourceRef'] as const;
const MESSAGE = ['name', 'language', 'purpose', 'body', 'active'] as const;
const TASK_CREATE = ['clientId', 'templateId', 'title', 'kind', 'period', 'transactionDate', 'dueDate', 'dueSource', 'channel', 'ownerUserId', 'officeAction', 'paymentExpected', 'tags', 'notes', 'lines'] as const;
const TASK_UPDATE = ['ownerUserId', 'channel', 'tags', 'notes', 'officeAction', 'paymentExpected'] as const;
const LINE_ADD = ['label', 'required', 'copyForm', 'copies', 'suppliedBy', 'printAndBring', 'reviewNote', 'neededBy'] as const;
const LINE_UPDATE = ['label', 'required', 'copyForm', 'copies', 'suppliedBy', 'printAndBring', 'neededBy'] as const;

const REASON = ['reason'] as const;
const reason = (b: Record<string, any>) => text(b.reason, 'reason');

// ---- clients ----------------------------------------------------------------------------------------------------
/**
 * A full TIN never reaches the command or the database in the clear. It arrives as `tinFull` (or, from the form, a TIN typed
 * into `tinMasked`) and becomes: a masked display value for the record, plus ciphertext and a keyed hash written in the same
 * batch. Anything else in `tinMasked` must already be in the masked form.
 */
function splitTin(body: Record<string, any>): { input: Record<string, any>; tin?: string } {
  const input = { ...body };
  const typed = input.tinFull ?? (typeof input.tinMasked === 'string' && /^[\d-]+$/.test(input.tinMasked.trim()) ? input.tinMasked : undefined);
  delete input.tinFull;
  if (typed !== undefined) {
    const tin = normalizeTin(String(typed));
    if (!tin) throw new ValidationError({ tinFull: ['Enter a valid TIN, like 123-456-789-00000'] });
    input.tinMasked = maskTin(tin);
    input.hasTin = true;
    return { input, tin };
  }
  if (input.tinMasked !== undefined && !/^•••-•••-\d{3}-\d{3,5}$/.test(String(input.tinMasked))) {
    throw new ValidationError({ tinMasked: ['This field holds the masked TIN only. Send a full TIN as tinFull.'] });
  }
  return { input };
}

async function saveClient(c: any, body: Record<string, any>, extra: Record<string, any>, status: 200 | 201) {
  const { input, tin } = splitTin(body);
  let encrypted: { ciphertext: string; hash: string } | undefined;
  if (tin) encrypted = { ciphertext: await encryptTin(c.env.TIN_ENCRYPTION_KEY, tin), hash: await hashTin(c.env.TIN_ENCRYPTION_KEY, tin) };
  return runWrite(c, {
    status,
    run: (cmd) => cmd.clients.upsert({ ...input, ...extra }),
    extra: (client, d1) =>
      encrypted ? [d1.prepare('UPDATE clients SET tin_encrypted = ?, tin_hash = ? WHERE id = ?').bind(encrypted.ciphertext, encrypted.hash, client.id)] : [],
  });
}

writeRoutes.post('/clients/duplicates', async (c) => {
  const body = await readBody(c, ['code', 'tin', 'name']);
  const tin = body.tin ? normalizeTin(String(body.tin)) : undefined;
  if (body.tin && !tin) throw new ValidationError({ tin: ['Enter a valid TIN, like 123-456-789-00000'] });
  const hash = tin ? await hashTin(c.env.TIN_ENCRYPTION_KEY, tin) : undefined;
  return runWrite(c, {
    idempotent: false,
    prepare: async (store) => {
      // the duplicate check compares TINs: put the TIN on the in-memory clients that share its hash, nowhere else
      if (!tin || !hash) return;
      const { results } = await c.env.DB.prepare('SELECT id FROM clients WHERE org_id = ? AND tin_hash = ?').bind(c.get('actor').orgId, hash).all<{ id: string }>();
      for (const row of results) {
        const client = store.clients.find((x) => x.id === row.id);
        if (client) client.tinFull = tin;
      }
    },
    run: (cmd) => cmd.clients.findDuplicates({ ...(body.code ? { code: body.code } : {}), ...(body.name ? { name: body.name } : {}), ...(tin ? { tin } : {}) }),
  });
});

writeRoutes.post('/clients', async (c) => saveClient(c, await readBody(c, CLIENT), {}, 201));
writeRoutes.patch('/clients/:id', async (c) => {
  const body = await readBody(c, CLIENT);
  return saveClient(c, body, { id: c.req.param('id'), version: ifMatchVersion(c) }, 200);
});
writeRoutes.post('/clients/:id/archive', async (c) => {
  const r = reason(await readBody(c, REASON));
  return runWrite(c, { run: (cmd) => cmd.clients.archive(c.req.param('id'), r) });
});
writeRoutes.post('/clients/:id/restore', async (c) => {
  const r = reason(await readBody(c, REASON, { optional: false }));
  return runWrite(c, { run: (cmd) => cmd.clients.restore(c.req.param('id'), r) });
});
writeRoutes.post('/clients/:id/reveal-tin', async (c) => {
  const id = c.req.param('id');
  return runWrite(c, {
    // the revealed value is returned once; the idempotency record keeps only that a reveal happened
    persisted: () => ({ revealed: true }),
    respond: (tin: string) => ({ tin }),
    run: async (cmd, store) => {
      cmd.queries.assertClient(id); // access first: a helper on an unassigned client learns nothing, not even whether a TIN exists
      const row = await c.env.DB.prepare('SELECT tin_encrypted FROM clients WHERE id = ? AND org_id = ?').bind(id, c.get('actor').orgId).first<{ tin_encrypted: string | null }>();
      const client = store.clients.find((x) => x.id === id);
      if (!row || !client) throw new NotFoundError('Client not found');
      if (!row.tin_encrypted) throw new NotFoundError('No full TIN is stored for this client');
      client.tinFull = await decryptTin(c.env.TIN_ENCRYPTION_KEY, row.tin_encrypted);
      return cmd.clients.revealTin(id);
    },
  });
});

// ---- contacts, authorizations -----------------------------------------------------------------------------------
writeRoutes.post('/contacts', async (c) => {
  const body = await readBody(c, CONTACT);
  return runWrite(c, { status: 201, run: (cmd) => cmd.contacts.upsert(body) });
});
writeRoutes.patch('/contacts/:id', async (c) => {
  const body = await readBody(c, CONTACT);
  return runWrite(c, { run: (cmd) => cmd.contacts.upsert({ ...body, id: c.req.param('id'), version: ifMatchVersion(c) }) });
});
writeRoutes.delete('/contacts/:id', async (c) => {
  const r = reason(await readBody(c, REASON));
  return runWrite(c, { run: (cmd) => cmd.contacts.remove(c.req.param('id'), r) });
});

writeRoutes.post('/authorizations', async (c) => {
  const body = await readBody(c, AUTHORIZATION);
  return runWrite(c, { status: 201, run: (cmd) => cmd.authorizations.upsert(body) });
});
writeRoutes.patch('/authorizations/:id', async (c) => {
  const body = await readBody(c, AUTHORIZATION);
  return runWrite(c, { run: (cmd) => cmd.authorizations.upsert({ ...body, id: c.req.param('id'), version: ifMatchVersion(c) }) });
});
writeRoutes.post('/authorizations/:id/replace', async (c) => {
  const body = await readBody(c, AUTHORIZATION);
  return runWrite(c, { status: 201, run: (cmd) => cmd.authorizations.replace(c.req.param('id'), body) });
});

// ---- templates, deadlines, holidays, messages (owner only: checked by the command, which every route runs) ---------------
writeRoutes.post('/templates', async (c) => {
  const { lines, ...template } = await readBody(c, TEMPLATE);
  return runWrite(c, { status: 201, run: (cmd) => cmd.templates.save(template, lines ?? []) });
});
writeRoutes.put('/templates/:id', async (c) => {
  const { lines, ...template } = await readBody(c, TEMPLATE);
  return runWrite(c, { run: (cmd) => cmd.templates.save({ ...template, id: c.req.param('id'), version: ifMatchVersion(c) }, lines ?? []) });
});
writeRoutes.post('/templates/:id/verify', async (c) => {
  const body = await readBody(c, VERIFY);
  return runWrite(c, { run: (cmd) => cmd.templates.markVerified(c.req.param('id'), body as never) });
});

writeRoutes.post('/deadline-moves', async (c) => {
  const { applyToOpenTasks, ...move } = await readBody(c, DEADLINE_MOVE);
  return runWrite(c, { status: 201, run: (cmd) => cmd.deadlineMoves.save(move, applyToOpenTasks === true) });
});
writeRoutes.delete('/deadline-moves/:id', async (c) => {
  const r = reason(await readBody(c, REASON));
  return runWrite(c, { run: (cmd) => cmd.deadlineMoves.remove(c.req.param('id'), r) });
});

writeRoutes.post('/holidays', async (c) => {
  const body = await readBody(c, HOLIDAY);
  return runWrite(c, { status: 201, run: (cmd) => cmd.holidays.save(body) });
});
writeRoutes.put('/holidays/:id', async (c) => {
  const body = await readBody(c, HOLIDAY);
  return runWrite(c, { run: (cmd) => cmd.holidays.save({ ...body, id: c.req.param('id'), version: ifMatchVersion(c) }) });
});
writeRoutes.delete('/holidays/:id', async (c) => runWrite(c, { run: (cmd) => cmd.holidays.remove(c.req.param('id')) }));

writeRoutes.post('/messages', async (c) => {
  const body = await readBody(c, MESSAGE);
  return runWrite(c, { status: 201, run: (cmd) => cmd.messages.save(body) });
});
writeRoutes.put('/messages/:id', async (c) => {
  const body = await readBody(c, MESSAGE);
  return runWrite(c, { run: (cmd) => cmd.messages.save({ ...body, id: c.req.param('id'), version: ifMatchVersion(c) }) });
});

// ---- tasks and lines --------------------------------------------------------------------------------------------
writeRoutes.post('/tasks/open-period/preview', async (c) => {
  const body = await readBody(c, ['period', 'clientIds']);
  return runWrite(c, { idempotent: false, run: (cmd) => cmd.tasks.previewOpenPeriod(text(body.period, 'period'), Array.isArray(body.clientIds) ? body.clientIds : []) });
});
writeRoutes.post('/tasks/open-period', async (c) => {
  const body = await readBody(c, ['period', 'selections']);
  return runWrite(c, { status: 201, run: (cmd) => cmd.tasks.openPeriod(body as never) });
});
writeRoutes.post('/tasks', async (c) => {
  const { lines, ...task } = await readBody(c, TASK_CREATE);
  return runWrite(c, { status: 201, run: (cmd) => cmd.tasks.create(task, lines ?? []) });
});
writeRoutes.patch('/tasks/:id', async (c) => {
  const body = await readBody(c, TASK_UPDATE);
  return runWrite(c, { run: (cmd) => cmd.tasks.update(c.req.param('id'), { ...body, version: ifMatchVersion(c) }) });
});
writeRoutes.post('/tasks/:id/status', async (c) => {
  const body = await readBody(c, ['to', 'reason']);
  return runWrite(c, { run: (cmd) => cmd.tasks.setStatus(c.req.param('id'), text(body.to, 'to') as never, body.reason) });
});
writeRoutes.post('/tasks/:id/submit', async (c) => {
  const body = await readBody(c, ['on', 'via', 'ref', 'ackDocumentId', 'note']);
  return runWrite(c, { run: (cmd) => cmd.tasks.markSubmitted(c.req.param('id'), body as never) });
});
writeRoutes.post('/tasks/:id/complete', async (c) => {
  const body = await readBody(c, ['on', 'noEvidenceReason']);
  return runWrite(c, { run: (cmd) => cmd.tasks.markCompleted(c.req.param('id'), body as never) });
});
writeRoutes.post('/tasks/:id/override', async (c) => {
  const body = await readBody(c, ['status', 'reason']);
  return runWrite(c, { run: (cmd) => cmd.tasks.override(c.req.param('id'), text(body.status, 'status') as never, reason(body)) });
});
writeRoutes.post('/tasks/:id/clear-override', async (c) => {
  const r = reason(await readBody(c, REASON));
  return runWrite(c, { run: (cmd) => cmd.tasks.clearOverride(c.req.param('id'), r) });
});
writeRoutes.post('/tasks/:id/due', async (c) => {
  const body = await readBody(c, ['dueDate', 'ref', 'reason', 'url']);
  return runWrite(c, { run: (cmd) => cmd.tasks.changeDue(c.req.param('id'), text(body.dueDate, 'dueDate'), text(body.ref, 'ref'), reason(body), body.url) });
});
writeRoutes.put('/tasks/:id/next-action', async (c) => {
  const body = await readBody(c, ['next']);
  return runWrite(c, { run: (cmd) => cmd.tasks.setNextAction(c.req.param('id'), body.next ?? null) });
});
writeRoutes.post('/tasks/:id/archive', async (c) => {
  const r = reason(await readBody(c, REASON));
  return runWrite(c, { run: (cmd) => cmd.tasks.archive(c.req.param('id'), r) });
});
writeRoutes.post('/tasks/:id/restore', async (c) => {
  const r = reason(await readBody(c, REASON));
  return runWrite(c, { run: (cmd) => cmd.tasks.restore(c.req.param('id'), r) });
});
writeRoutes.post('/tasks/:id/duplicate', async (c) => runWrite(c, { status: 201, run: (cmd) => cmd.tasks.duplicateForNextPeriod(c.req.param('id')) }));

writeRoutes.post('/tasks/:taskId/lines', async (c) => {
  const body = await readBody(c, LINE_ADD);
  return runWrite(c, { status: 201, run: (cmd) => cmd.lines.addAdHoc(c.req.param('taskId'), body) });
});
writeRoutes.put('/tasks/:taskId/lines/order', async (c) => {
  const body = await readBody(c, ['orderedIds']);
  if (!Array.isArray(body.orderedIds)) throw new ValidationError({ orderedIds: ['orderedIds must be a list of line ids'] });
  return runWrite(c, { run: (cmd) => cmd.lines.reorder(c.req.param('taskId'), body.orderedIds) });
});
writeRoutes.post('/lines/:id/status', async (c) => {
  const body = await readBody(c, ['to', 'note', 'reason', 'via', 'on']);
  const { to, ...extra } = body;
  return runWrite(c, { run: (cmd) => cmd.lines.setStatus(c.req.param('id'), text(to, 'to') as never, extra) });
});
writeRoutes.patch('/lines/:id', async (c) => {
  const body = await readBody(c, LINE_UPDATE);
  return runWrite(c, { run: (cmd) => cmd.lines.update(c.req.param('id'), { ...body, version: ifMatchVersion(c) }) });
});
