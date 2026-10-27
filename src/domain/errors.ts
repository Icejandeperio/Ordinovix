/**
 * Typed errors the data layer throws and the screens map to a 403 or 404 view (spec 11.20).
 * `code` matches what the API will return, so the same screens work unchanged against it.
 */
export type ErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'RULE_VIOLATION' | 'VALIDATION';

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends Error {
  readonly code = 'FORBIDDEN' as const;
  constructor(message = 'No access') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export type ErrorKind = 'forbidden' | 'not_found' | 'offline' | 'generic';

/** Classify any thrown value for display. Falls back to the message for errors from before typed codes existed. */
export function classifyError(error: unknown): ErrorKind {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'FORBIDDEN') return 'forbidden';
  if (code === 'NOT_FOUND') return 'not_found';
  const message = error instanceof Error ? error.message : '';
  if (/offline|network error/i.test(message)) return 'offline';
  return 'generic';
}
