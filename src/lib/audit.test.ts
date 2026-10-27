import { describe, it, expect } from 'vitest';
import { isSensitiveEvent, isOverrideEvent, describeDelta, describeDevice, recordLink, ACTION_LABELS } from './audit';

describe('lib/audit (spec 11.18 views)', () => {
  it('Sensitive covers TIN reveals, file downloads and access changes', () => {
    for (const action of ['tin_revealed', 'file_downloaded', 'access_granted', 'access_revoked'] as const) {
      expect(isSensitiveEvent({ action }), action).toBe(true);
    }
    expect(isSensitiveEvent({ action: 'status_changed' })).toBe(false);
    expect(isSensitiveEvent({ action: 'file_viewed' })).toBe(false);
  });

  it('Overrides and reasons covers overrides, due-date changes and any event with a reason', () => {
    expect(isOverrideEvent({ action: 'overridden' })).toBe(true);
    expect(isOverrideEvent({ action: 'due_changed' })).toBe(true);
    expect(isOverrideEvent({ action: 'archived', reason: 'Client closed the practice' })).toBe(true);
    expect(isOverrideEvent({ action: 'created' })).toBe(false);
  });

  it('every action has a readable label', () => {
    expect(ACTION_LABELS.tin_revealed).toBe('TIN Revealed');
    expect(Object.values(ACTION_LABELS).every((l) => l.length > 2)).toBe(true);
  });

  it('describeDelta joins the summary, before to after and the reason, and never throws on odd values', () => {
    expect(describeDelta({ summary: 'Revealed TIN for Horizon' })).toBe('Revealed TIN for Horizon');
    expect(describeDelta({ summary: 'Changed status', before: 'waiting', after: 'ready', reason: 'Client confirmed' })).toBe('Changed status · waiting → ready · Reason: Client confirmed');
    expect(describeDelta({ summary: 'x', before: { a: 1 }, after: undefined })).toBe('x · {"a":1} → —');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => describeDelta({ summary: 'x', before: circular })).not.toThrow();
  });

  it('links to the page of a client, task or visit, and to the client for other records', () => {
    expect(recordLink({ entity: 'task', entityId: 't1' })).toBe('/tasks/t1');
    expect(recordLink({ entity: 'visit', entityId: 'v1' })).toBe('/visits/v1');
    expect(recordLink({ entity: 'client', entityId: 'c1' })).toBe('/clients/c1');
    expect(recordLink({ entity: 'document', entityId: 'd1', clientId: 'c1' })).toBe('/clients/c1');
    expect(recordLink({ entity: 'settings', entityId: 's1' })).toBeNull();
  });

  it('describeDevice names the browser and the system', () => {
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36')).toBe('Chrome on Windows');
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605 Version/18 Mobile Safari/604')).toBe('Safari on iOS');
    expect(describeDevice(undefined)).toBeUndefined();
  });
});
