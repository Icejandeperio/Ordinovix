import type { ActivityAction, ActivityEntity, ActivityEvent } from '@/domain/types';

/** Spec 11.18 built-in view "Sensitive": TIN reveals, file downloads and access changes. */
export const SENSITIVE_ACTIONS: readonly ActivityAction[] = ['tin_revealed', 'file_downloaded', 'access_granted', 'access_revoked'];

/** Spec 11.18 built-in view "Overrides and reasons": a status override, a due-date change, or any event with a reason. */
const OVERRIDE_ACTIONS: readonly ActivityAction[] = ['overridden', 'due_changed'];

export const isSensitiveEvent = (e: Pick<ActivityEvent, 'action'>): boolean => SENSITIVE_ACTIONS.includes(e.action);

export const isOverrideEvent = (e: Pick<ActivityEvent, 'action' | 'reason'>): boolean =>
  OVERRIDE_ACTIONS.includes(e.action) || Boolean(e.reason);

export const ACTION_LABELS: Record<ActivityAction, string> = {
  created: 'Created',
  updated: 'Updated',
  status_changed: 'Status Changed',
  overridden: 'Status Overridden',
  due_changed: 'Due Date Changed',
  reassigned: 'Reassigned',
  archived: 'Archived',
  restored: 'Restored',
  deleted: 'Deleted',
  file_uploaded: 'File Uploaded',
  file_replaced: 'File Replaced',
  file_viewed: 'File Viewed',
  file_downloaded: 'File Downloaded',
  tin_revealed: 'TIN Revealed',
  follow_up_sent: 'Follow-up Sent',
  response_logged: 'Response Logged',
  escalated: 'Escalated',
  resolved: 'Resolved',
  visit_started: 'Visit Started',
  outcome_recorded: 'Outcome Recorded',
  visit_finished: 'Visit Finished',
  visit_cancelled: 'Visit Cancelled',
  access_granted: 'Access Granted',
  access_revoked: 'Access Revoked',
  signed_in: 'Signed In',
  exported: 'Exported',
  imported: 'Imported',
  verified: 'Verified',
};

export const ENTITY_LABELS: Record<ActivityEntity, string> = {
  client: 'Client',
  contact: 'Contact',
  authorization: 'Authorization',
  task: 'Task',
  line: 'Checklist line',
  document: 'Document',
  follow_up: 'Follow-up',
  visit: 'Visit',
  visit_item: 'Visit item',
  payment: 'Payment',
  template: 'Template',
  office: 'Office',
  settings: 'Settings',
  membership: 'Access',
  note: 'Note',
};

/** Where the record of an event lives in the app, when it has a page. */
export function recordLink(e: Pick<ActivityEvent, 'entity' | 'entityId' | 'clientId'>): string | null {
  if (e.entity === 'client') return `/clients/${e.entityId}`;
  if (e.entity === 'task') return `/tasks/${e.entityId}`;
  if (e.entity === 'visit') return `/visits/${e.entityId}`;
  return e.clientId ? `/clients/${e.clientId}` : null;
}

const short = (v: unknown): string => {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'string') return v;
  try {
    const text = JSON.stringify(v);
    return text.length > 80 ? `${text.slice(0, 77)}…` : text;
  } catch {
    return String(v);
  }
};

/** "before → after" and the reason, as one line for the Details column and the CSV. */
export function describeDelta(e: Pick<ActivityEvent, 'summary' | 'before' | 'after' | 'reason'>): string {
  const parts = [e.summary];
  if (e.before !== undefined || e.after !== undefined) parts.push(`${short(e.before)} → ${short(e.after)}`);
  if (e.reason) parts.push(`Reason: ${e.reason}`);
  return parts.join(' · ');
}

/** "Chrome on Windows" from a user-agent string; undefined when there is none to read. */
export function describeDevice(userAgent?: string): string | undefined {
  if (!userAgent) return undefined;
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /Firefox\//.test(userAgent) ? 'Firefox' : /Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : 'Browser';
  const os = /Windows/.test(userAgent) ? 'Windows' : /Android/.test(userAgent) ? 'Android' : /iPhone|iPad|iOS/.test(userAgent) ? 'iOS' : /Mac OS X/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : 'unknown OS';
  return `${browser} on ${os}`;
}
