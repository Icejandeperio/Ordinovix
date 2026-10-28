/**
 * `Repositories` over the Worker API (BACKEND_PLAN section 4). A thin client: every method is one request; the rules, the
 * permission checks and the response shapes are the server's (the same code the mock runs). No screen knows which one it has.
 *
 * - Updates carry the loaded `version` as If-Match (the caller's `version` field, as in the mock); without one the client sends
 *   `If-Match: *`, which the server accepts as "any version", like an update with no version in the mock.
 * - A trailing `{ idempotencyKey }` argument (what the offline queue appends) becomes the Idempotency-Key header, so a replay
 *   after a lost reply is applied once.
 * - Lists are followed to their last page (the API pages at most 100 items), so a screen gets the whole list as it does from the mock.
 */
import type { Repositories } from '../repositories';
import type { Page } from '@/domain/types';
import { request, type Query, type RequestOptions } from './http';

type Fetch = typeof fetch;

const BASE_FIELDS = ['id', 'orgId', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'version', 'deletedAt', 'deletedReason'] as const;

/** A copy of the record's fields the server accepts: the base record fields (id, org, stamps, version) are the server's. */
const writable = <T extends object>(record: T, extraDrop: readonly string[] = []): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([k, v]) => v !== undefined && !(BASE_FIELDS as readonly string[]).includes(k) && !extraDrop.includes(k)));

const versionOf = (record: { version?: number } | undefined): number | '*' => record?.version ?? '*';

/** Splits a trailing `{ idempotencyKey }` (appended by the offline queue) off the arguments. */
function withKey<A extends unknown[]>(args: A): { args: A; key?: string } {
  const last = args.at(-1);
  if (last && typeof last === 'object' && 'idempotencyKey' in (last as object)) {
    const key = (last as { idempotencyKey?: unknown }).idempotencyKey;
    return { args: args.slice(0, -1) as A, key: typeof key === 'string' ? key : undefined };
  }
  return { args };
}

export function createApiRepositories(fetchImpl?: Fetch): Repositories {
  const call = <T>(method: string, path: string, o: RequestOptions = {}) => request<T>(method, path, { ...o, fetchImpl });
  const V1 = '/api/v1';

  /** Follows nextCursor to the end of a paged list. */
  async function all<T>(path: string, query: Query = {}): Promise<Page<T>> {
    const items: T[] = [];
    let cursor: string | undefined;
    let total: number | undefined;
    let extra: Record<string, unknown> = {};
    for (let page = 0; page < 200; page++) {
      const { items: batch, nextCursor, total: t, ...rest } = await call<Page<T> & Record<string, unknown>>('GET', `${V1}${path}`, { query: { ...query, limit: 100, cursor } });
      items.push(...batch);
      total = t ?? total;
      extra = rest;
      cursor = nextCursor;
      if (!cursor) break;
    }
    return { items, total: total ?? items.length, ...extra } as Page<T>;
  }
  const get = <T>(path: string, query?: Query) => call<T>('GET', `${V1}${path}`, { query });
  const post = <T>(path: string, body?: unknown, o: RequestOptions = {}) => call<T>('POST', `${V1}${path}`, { body: body ?? {}, ...o });
  const put = <T>(path: string, body: unknown, o: RequestOptions = {}) => call<T>('PUT', `${V1}${path}`, { body, ...o });
  const patch = <T>(path: string, body: unknown, o: RequestOptions = {}) => call<T>('PATCH', `${V1}${path}`, { body, ...o });
  const del = <T>(path: string, body?: unknown) => call<T>('DELETE', `${V1}${path}`, { body });
  const done = async (p: Promise<unknown>): Promise<void> => void (await p);
  /** create when there is no id, update (with If-Match) when there is */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const save = <T extends { id?: string; version?: number }>(base: string, record: T, o: RequestOptions = {}, drop: readonly string[] = []): Promise<any> =>
    record.id ? patch(`${base}/${record.id}`, writable(record, drop), { ...o, ifMatch: versionOf(record) }) : post(base, writable(record, drop), o);

  const repos: Repositories = {
    session: {
      me: () => get('/session/me'),
      signOut: () => done(call('POST', '/api/auth/sign-out', { body: {} })),
    },
    prefs: { save: (p) => put('/prefs', writable(p, ['userId'])) },
    settings: { save: (s) => put('/settings', writable(s, ['orgId']), { ifMatch: versionOf(s) }) },
    memberships: {
      list: () => get('/memberships'),
      invite: (m) => post('/memberships', m, { ifMatch: undefined }),
      update: (id, m) => patch(`/memberships/${id}`, writable(m), { ifMatch: versionOf(m) }),
      revoke: (id) => done(post(`/memberships/${id}/revoke`)),
    },

    today: { queue: (scope) => get('/today', { scope }) },

    clients: {
      list: (f) => all('/clients', { ...f }),
      get: (id) => get(`/clients/${id}`),
      // archive state and the import batch are changed only by their own routes, so a whole record held by a screen is sent without them
      upsert: (c) => save('/clients', c as { id?: string; version?: number }, {}, ['status', 'archivedReason', 'importBatchId']),
      archive: (id, reason) => done(post(`/clients/${id}/archive`, { reason })),
      restore: (id, reason) => done(post(`/clients/${id}/restore`, { reason })),
      revealTin: async (id) => (await post<{ tin: string }>(`/clients/${id}/reveal-tin`)).tin,
      findDuplicates: (c) => post('/clients/duplicates', c),
      importPreview: (rows, mapping) => post('/clients/import/preview', { rows, mapping }),
      importCommit: (preview) => post('/clients/import/commit', { preview }),
      importUndo: (batchId) => done(post(`/clients/import/${batchId}/undo`)),
    },

    contacts: {
      listByClient: (clientId) => get(`/clients/${clientId}/contacts`),
      upsert: (c) => save('/contacts', c as { id?: string; version?: number }),
      remove: (id, reason) => done(del(`/contacts/${id}`, { reason })),
    },

    authorizations: {
      listByClient: (clientId) => get(`/clients/${clientId}/authorizations`),
      upsert: (a) => save('/authorizations', a as { id?: string; version?: number }),
      replace: (oldId, next) => post(`/authorizations/${oldId}/replace`, writable(next)),
    },

    templates: {
      list: (f) => get('/templates', { ...f }),
      get: (id) => get(`/templates/${id}`),
      save: (t, lines) => {
        const { id, ...rest } = writable(t) as Record<string, unknown> & { id?: string };
        const body = { ...rest, ...(lines && lines.length ? { lines: lines.map((l) => writable(l, ['taskTemplateId'])) } : {}) };
        return t.id ? put(`/templates/${t.id}`, body, { ifMatch: versionOf(t) }) : post('/templates', body);
      },
      markVerified: (id, v) => post(`/templates/${id}/verify`, v),
    },

    deadlineMoves: {
      list: () => get('/deadline-moves'),
      save: (m, applyToOpenTasks) => post('/deadline-moves', { ...writable(m), applyToOpenTasks }),
      remove: (id, reason) => done(del(`/deadline-moves/${id}`, { reason })),
    },

    holidays: {
      list: (year) => get('/holidays', { year }),
      save: (h) => (h.id ? put(`/holidays/${h.id}`, writable(h), { ifMatch: versionOf(h) }) : post('/holidays', writable(h))),
      remove: (id) => done(del(`/holidays/${id}`)),
    },

    tasks: {
      list: (f) => all('/tasks', { ...f }),
      get: (id) => get(`/tasks/${id}`),
      create: (t, lines) => post('/tasks', { ...writable(t, ['status']), lines: lines.map((l) => writable(l)) }),
      update: (id, t) => patch(`/tasks/${id}`, writable(t), { ifMatch: versionOf(t) }),
      setStatus: (id, to, reason) => post(`/tasks/${id}/status`, { to, reason }),
      markSubmitted: (id, s) => post(`/tasks/${id}/submit`, s),
      markCompleted: (id, c) => post(`/tasks/${id}/complete`, c),
      override: (id, status, reason) => post(`/tasks/${id}/override`, { status, reason }),
      clearOverride: (id, reason) => post(`/tasks/${id}/clear-override`, { reason }),
      changeDue: (id, dueDate, ref, reason, url) => post(`/tasks/${id}/due`, { dueDate, ref, reason, url }),
      setNextAction: (id, next) => put(`/tasks/${id}/next-action`, { next }),
      archive: (id, reason) => done(post(`/tasks/${id}/archive`, { reason })),
      restore: (id, reason) => done(post(`/tasks/${id}/restore`, { reason })),
      duplicateForNextPeriod: (id) => post(`/tasks/${id}/duplicate`),
      previewOpenPeriod: (period, clientIds) => post('/tasks/open-period/preview', { period, clientIds }),
      openPeriod: (plan) => post('/tasks/open-period', plan),
      board: (f) => get('/tasks/board', { ...f }),
    },

    lines: {
      setStatus: (id, to, extra, ...rest: unknown[]) => {
        const { key } = withKey(rest);
        return post(`/lines/${id}/status`, { to, ...extra }, { key });
      },
      addAdHoc: (taskId, line) => post(`/tasks/${taskId}/lines`, writable(line, ['taskId', 'clientId', 'status', 'documentIds', 'sortOrder', 'lateDiscovered'])),
      update: (id, line) => patch(`/lines/${id}`, writable(line), { ifMatch: versionOf(line) }),
      reorder: (taskId, orderedIds) => done(put(`/tasks/${taskId}/lines/order`, { orderedIds })),
      history: (id) => get(`/lines/${id}/history`),
    },

    documents: {
      list: (f) => all('/documents', { ...f }),
      upload: (meta, file, thumb, info) => {
        const form = new FormData();
        form.set('meta', JSON.stringify(meta));
        form.set('file', file, info?.originalName ?? 'file');
        if (thumb) form.set('thumb', thumb, 'thumb.jpg');
        // the server computes the hash itself
        form.set('info', JSON.stringify({ originalName: info?.originalName, originalSizeBytes: info?.originalSizeBytes, pageCount: info?.pageCount }));
        return call('POST', `${V1}/documents`, { form });
      },
      replace: (id, file, thumb, info) => {
        const form = new FormData();
        form.set('file', file, info?.originalName ?? 'file');
        if (thumb) form.set('thumb', thumb, 'thumb.jpg');
        form.set('info', JSON.stringify({ originalName: info?.originalName, originalSizeBytes: info?.originalSizeBytes }));
        return call('POST', `${V1}/documents/${id}/replace`, { form });
      },
      update: (id, d) => patch(`/documents/${id}`, writable(d), { ifMatch: versionOf(d) }),
      remove: (id, reason) => done(del(`/documents/${id}`, { reason })),
      getUrl: async (id, purpose) => (await get<{ url: string }>(`/files/${id}`, { purpose })).url,
      findBySha: (sha256, clientId) => get('/documents/by-sha', { sha256, clientId }),
    },

    followUps: {
      list: (f) => all('/follow-ups', { ...f }),
      get: (id) => get(`/follow-ups/${id}`),
      create: (f) => post('/follow-ups', writable(f)),
      markSent: (id, a) => post(`/follow-ups/${id}/sent`, a),
      logResponse: (id, r) => post(`/follow-ups/${id}/response`, r),
      escalate: (id, reason) => post(`/follow-ups/${id}/escalate`, { reason }),
      resolve: (id, reason) => post(`/follow-ups/${id}/resolve`, reason ? { reason } : {}),
    },

    messages: {
      list: () => get('/messages'),
      save: (m) => (m.id ? put(`/messages/${m.id}`, writable(m), { ifMatch: versionOf(m) }) : post('/messages', writable(m))),
    },

    offices: {
      list: (f) => get('/offices', { ...f }),
      get: (id) => get(`/offices/${id}`),
      save: (o) => (o.id ? put(`/offices/${o.id}`, writable(o, ['isSample']), { ifMatch: versionOf(o) }) : post('/offices', writable(o, ['isSample']))),
    },

    visits: {
      list: (f) => all('/visits', { ...f }),
      get: (id) => get(`/visits/${id}`),
      create: (v, items) => post('/visits', { ...writable(v, ['status', 'packedLineIds', 'packedKitItemIds']), items: items ?? [] }),
      update: (id, v) => patch(`/visits/${id}`, writable(v), { ifMatch: versionOf(v) }),
      suggestTasks: (visitId) => get(`/visits/${visitId}/suggestions`),
      addItem: (visitId, taskId, action) => post(`/visits/${visitId}/items`, { taskId, action }),
      // the item id names the item; the visit segment in the path is not used by the server, so '_' stands for "its visit"
      updateItem: (itemId, i) => patch(`/visits/_/items/${itemId}`, writable(i), { ifMatch: versionOf(i) }),
      removeItem: (itemId) => done(del(`/visits/_/items/${itemId}`)),
      setPacked: (visitId, ref, packed, ...rest: unknown[]) => {
        const { key } = withKey(rest);
        return done(put(`/visits/${visitId}/packed`, { ...ref, packed }, { key }));
      },
      start: (id, leaveAnywayReason) => post(`/visits/${id}/start`, leaveAnywayReason ? { leaveAnywayReason } : {}),
      recordOutcome: (itemId, o, ...rest: unknown[]) => {
        const { key } = withKey(rest);
        return post(`/visits/_/items/${itemId}/outcome`, o, { key });
      },
      finish: (id, f) => post(`/visits/${id}/finish`, f),
      cancel: (id, reason) => done(post(`/visits/${id}/cancel`, { reason })),
    },

    visitKit: {
      list: () => get('/visit-kit'),
      save: (i) => (i.id ? put(`/visit-kit/${i.id}`, writable(i), { ifMatch: versionOf(i) }) : post('/visit-kit', writable(i))),
    },

    payments: {
      list: (f) => all('/payments', { ...f }) as never,
      save: (p) => save('/payments', p as { id?: string; version?: number }),
      remove: (id, reason) => done(del(`/payments/${id}`, { reason })),
    },

    notes: {
      list: (entity, entityId) => get('/notes', { entity, entityId }),
      save: (n, ...rest: unknown[]) => {
        const { key } = withKey(rest);
        return save('/notes', n as { id?: string; version?: number }, { key });
      },
    },

    savedViews: {
      list: (page) => get('/saved-views', { page }),
      save: (v) => (v.id ? put(`/saved-views/${v.id}`, writable(v, ['userId']), { ifMatch: versionOf(v) }) : post('/saved-views', writable(v, ['userId']))),
      remove: (id) => done(del(`/saved-views/${id}`)),
    },

    notifications: {
      list: (f) => all('/notifications', { ...f }),
      markRead: (ids) => done(post('/notifications/read', ids === 'all' ? { all: true } : { ids })),
      unreadCount: () => get('/notifications/unread-count'),
    },

    push: {
      subscribe: (sub) => done(post('/push/subscriptions', { endpoint: sub.endpoint, keys: sub.keys, expirationTime: sub.expirationTime ?? undefined })),
      unsubscribe: (endpoint) => done(del(`/push/subscriptions?endpoint=${encodeURIComponent(endpoint)}`)),
      test: () => done(post('/push/test')),
    },

    calendar: { range: (from, to, f) => get('/calendar', { from, to, ...f }) },
    insights: { get: (tab, f) => get(`/insights/${tab}`, { ...f }) as never },

    baseline: {
      get: () => get('/baseline'),
      save: (b) => put('/baseline', writable(b), { ifMatch: versionOf(b) }),
    },
    pulses: {
      list: () => get('/pulses'),
      save: (p) => post('/pulses', writable(p)),
    },

    reports: {
      clientChecklist: (clientId) => get(`/reports/client-checklist/${clientId}`),
      clientHistory: (clientId, year) => get(`/reports/client-history/${clientId}`, { year }),
      monthlySummary: (month) => get('/reports/monthly-summary', { month }),
      exportCsv: (kind) => call<Blob>('GET', `${V1}/reports/export/${kind}.csv`, { blob: true }),
      fullBackup: () => call<Blob>('GET', `${V1}/reports/backup`, { blob: true }),
    },

    activity: { list: (f) => all('/activity', { ...f }) },
    search: { query: (q, f) => get('/search', { q, types: f?.types }) },
  };

  return repos;
}
