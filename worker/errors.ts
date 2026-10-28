import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ErrorHandler, NotFoundHandler } from 'hono';
import type { AppEnv } from './env';

/**
 * The JSON error shape and status codes of BACKEND_PLAN section 2. The domain errors carry their own `code`, so the
 * mapping is by code (the same one the screens already handle). Their messages are written for people and are safe to
 * return. Any other error is a bug: the response says nothing about it except an id, and the log line has the id and
 * the error type only, never its message (a message could carry a value that must not reach a log).
 */
export interface ErrorBody {
  error: { code: string; message: string; fields?: unknown; current?: unknown; errorId?: string };
}

const STATUS_BY_CODE: Record<string, 400 | 403 | 404 | 409 | 422 | 429> = {
  VALIDATION: 422,
  FORBIDDEN: 403,
  ACCESS_PENDING: 403,
  NOT_FOUND: 404,
  RULE_VIOLATION: 409,
  VERSION_CONFLICT: 409,
  RATE_LIMITED: 429,
};

export function errorResponse(c: Context<AppEnv>, status: 400 | 403 | 404 | 409 | 422 | 429 | 500, body: ErrorBody): Response {
  return c.json(body, status);
}

export const handleError: ErrorHandler<AppEnv> = (err, c) => {
  const code = (err as { code?: unknown } | null)?.code;
  if (err instanceof Error && typeof code === 'string' && code in STATUS_BY_CODE) {
    const body: ErrorBody = { error: { code, message: err.message } };
    const fieldErrors = (err as { fieldErrors?: unknown }).fieldErrors;
    if (code === 'VALIDATION' && fieldErrors) body.error.fields = fieldErrors;
    if (code === 'VERSION_CONFLICT') body.error.current = (err as { current?: unknown }).current;
    return errorResponse(c, STATUS_BY_CODE[code], body);
  }
  if (err instanceof HTTPException && err.status >= 400 && err.status < 500) {
    return errorResponse(c, err.status === 404 ? 404 : 400, {
      error: { code: err.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', message: err.status === 404 ? 'Not found' : 'The request could not be read' },
    });
  }
  const errorId = crypto.randomUUID();
  console.error(`unhandled error ${errorId} (${err instanceof Error ? err.name : typeof err})`);
  return errorResponse(c, 500, { error: { code: 'INTERNAL', message: 'Something went wrong on our side. Try again; if it keeps happening, quote the error ID.', errorId } });
};

export const handleNotFound: NotFoundHandler<AppEnv> = (c) =>
  errorResponse(c, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
