import type { AppBindings } from '../env';

/**
 * The daily clean-up (BACKEND_PLAN 7a):
 *  1. idempotency keys older than 7 days are deleted;
 *  2. file bytes of a REMOVED document whose retention date has passed are deleted from R2.
 *
 * Step 2 deletes nothing unless a retention period is configured: a document gets `retain_until` only when a period is
 * chosen, and nothing sets it today (ADR-0002 "Deferred": automatic retention deletion stays off until the client picks a
 * period). A document that is not removed, or has no `retain_until`, or whose date is still ahead, is never touched. The
 * database row stays (soft delete): its storage key becomes `purged:<id>` so the record, its history and the audit trail
 * remain, and one activity event notes that the bytes were purged.
 */
const KEY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function runRetention(env: AppBindings, now: Date = new Date()): Promise<{ keysPurged: number; filesPurged: number }> {
  const cutoff = new Date(now.getTime() - KEY_TTL_MS).toISOString();
  const keys = await env.DB.prepare('DELETE FROM idempotency_keys WHERE created_at < ?').bind(cutoff).run();

  const today = new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10); // Asia/Manila calendar date
  const { results } = await env.DB
    .prepare(
      "SELECT id, org_id, client_id, display_name, storage_key, thumbnail_key FROM documents WHERE deleted_at IS NOT NULL AND retain_until IS NOT NULL AND retain_until < ? AND storage_key NOT LIKE 'purged:%' AND storage_key NOT LIKE 'data:%'",
    )
    .bind(today)
    .all<{ id: string; org_id: string; client_id: string; display_name: string; storage_key: string; thumbnail_key: string | null }>();

  let filesPurged = 0;
  const stamp = new Date(now.getTime() + 8 * 3600_000).toISOString().replace('Z', '+08:00');
  for (const doc of results) {
    await env.FILES.delete([doc.storage_key, ...(doc.thumbnail_key ? [doc.thumbnail_key] : [])]);
    await env.DB.batch([
      env.DB.prepare("UPDATE documents SET storage_key = 'purged:' || id, thumbnail_key = NULL, updated_at = ?, updated_by = 'system', version = version + 1 WHERE id = ?").bind(stamp, doc.id),
      env.DB
        .prepare("INSERT INTO activity (id, org_id, at, actor_id, entity, entity_id, client_id, action, summary, reason) VALUES (?, ?, ?, 'system', 'document', ?, ?, 'deleted', ?, 'retention period passed')")
        .bind(`act-retention-${doc.id}`, doc.org_id, stamp, doc.id, doc.client_id, `Retention: removed the stored file of ${doc.display_name}`),
    ]);
    filesPurged++;
  }
  return { keysPurged: keys.meta?.changes ?? 0, filesPurged };
}
