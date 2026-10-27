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

/** Field name (dotted for nested fields) to its messages. */
export type FieldErrors = Record<string, string[]>;

/** Input that breaks a field rule (spec section 12). `fieldErrors` lets a form show each message next to its field. */
export class ValidationError extends Error {
  readonly code = 'VALIDATION' as const;
  readonly fieldErrors: FieldErrors;
  constructor(fieldErrors: FieldErrors) {
    const first = Object.values(fieldErrors)[0]?.[0];
    super(first ?? 'Some fields are not valid');
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

/** The first message per field, or null when the error is not a ValidationError. For forms that show one message per field. */
export function fieldMessages(error: unknown): Record<string, string> | null {
  if ((error as { code?: string } | null)?.code !== 'VALIDATION') return null;
  const fe = (error as ValidationError).fieldErrors;
  if (!fe) return null;
  return Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0]]));
}

export type ErrorKind = 'forbidden' | 'not_found' | 'offline' | 'validation' | 'generic';

/** Classify any thrown value for display. Falls back to the message for errors from before typed codes existed. */
export function classifyError(error: unknown): ErrorKind {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'FORBIDDEN') return 'forbidden';
  if (code === 'NOT_FOUND') return 'not_found';
  if (code === 'VALIDATION') return 'validation';
  const message = error instanceof Error ? error.message : '';
  if (/offline|network error/i.test(message)) return 'offline';
  return 'generic';
}
