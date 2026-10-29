import {
  AccessPendingError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  UnauthenticatedError,
  ValidationError,
  VersionConflictError,
} from '@/domain/errors';
import { RuleViolationError } from '@/domain/rules';
import { getDevToday } from '@/lib/dates';
import { notifyAuthFailure } from '../auth-events';
import { FAILURE_RATE_KEY, OFFLINE_KEY } from '../dev-state';

/**
 * The HTTP layer of the API data source. One place that turns a response into data or into the typed error the screens already
 * handle (`FORBIDDEN`, `NOT_FOUND`, `RULE_VIOLATION`, `VALIDATION`, `VERSION_CONFLICT`...), and that adds the headers every write
 * needs: an Idempotency-Key (the offline queue passes its own so a replay is applied once) and, on updates, If-Match.
 */
export type Query = Record<string, string | number | boolean | string[] | undefined>;

export interface RequestOptions {
  query?: Query;
  /** JSON body. */
  body?: unknown;
  /** Multipart body (file uploads). */
  form?: FormData;
  /** The version of the record being updated; '*' when the caller does not know it (the server then skips the check). */
  ifMatch?: number | '*';
  /** Idempotency-Key for this write; a new one is made when absent. */
  key?: string;
  /** Read the body as a Blob (exports). */
  blob?: boolean;
  /** A request of the dev bootstrap itself (reset, sign-in): it must not wait for the bootstrap it belongs to. */
  bootstrap?: boolean;
  /** For tests: the fetch to use instead of the global one. */
  fetchImpl?: typeof fetch;
}

const read = (key: string): string | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

export function toQueryString(query: Query | undefined): string {
  if (!query) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    const text = Array.isArray(value) ? value.join(',') : String(value);
    if (text === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(text)}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

interface ErrorBody {
  error?: { code?: string; message?: string; fields?: Record<string, string[]>; current?: unknown };
}

/** The domain error for an API error answer. Unknown codes stay a plain Error with the server's message. */
export function toDomainError(status: number, body: ErrorBody | null): Error {
  const e = body?.error;
  const message = e?.message ?? `The server answered ${status}`;
  switch (e?.code) {
    case 'VALIDATION':
      return Object.assign(new ValidationError(e.fields ?? { form: [message] }), { message });
    case 'FORBIDDEN':
      return new ForbiddenError(message);
    case 'NOT_FOUND':
      return new NotFoundError(message);
    case 'RULE_VIOLATION':
      return new RuleViolationError(message);
    case 'VERSION_CONFLICT':
      return new VersionConflictError(e.current, message);
    case 'ACCESS_PENDING':
      return new AccessPendingError(message);
    case 'RATE_LIMITED':
      return new RateLimitedError(message);
    case 'UNAUTHENTICATED':
      return new UnauthenticatedError(message);
    default:
      return status === 401 ? new UnauthenticatedError() : new Error(message);
  }
}

/**
 * An answer from the edge or the dev proxy, not from the Worker: the Worker always answers an error as JSON. Such a request never
 * reached the application (or its answer was lost), so it is sent again; every write carries an Idempotency-Key, so a repeat that
 * did reach it is applied once.
 */
const RETRIES = 2;
const isGatewayFailure = (res: Response): boolean =>
  res.status === 502 || res.status === 503 || res.status === 504 || (res.status === 500 && !(res.headers.get('content-type') ?? '').includes('json'));

/** Runs once before the first request in dev mode (signs in as the chosen persona); see dev.ts. */
let beforeFirstRequest: (() => Promise<void>) | undefined;
export const setBeforeFirstRequest = (fn: (() => Promise<void>) | undefined) => {
  beforeFirstRequest = fn;
  ready = undefined;
};
let ready: Promise<void> | undefined;

export async function request<T = unknown>(method: string, path: string, o: RequestOptions = {}): Promise<T> {
  // The dev controls of the sample-data days still work: simulate an offline device or a failing network
  if (read(OFFLINE_KEY) === 'true') throw new Error('Network error: Device is currently simulated as offline');
  const failureRate = parseFloat(read(FAILURE_RATE_KEY) || '0');
  if (failureRate > 0 && Math.random() < failureRate) throw new Error('Simulated network request failure');

  if (beforeFirstRequest && !o.bootstrap) await (ready ??= beforeFirstRequest());

  const headers = new Headers({ Accept: 'application/json' });
  if (o.body !== undefined) headers.set('Content-Type', 'application/json');
  if (method !== 'GET') headers.set('Idempotency-Key', o.key ?? crypto.randomUUID());
  if (o.ifMatch !== undefined) headers.set('If-Match', o.ifMatch === '*' ? '*' : `"${o.ifMatch}"`);
  const today = getDevToday();
  if (today) headers.set('X-Dev-Today', today); // honoured only by a local Worker with DEV_AUTH=1

  const body = o.form ?? (o.body === undefined ? undefined : JSON.stringify(o.body));
  let res!: Response;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await (o.fetchImpl ?? fetch)(`${path}${toQueryString(o.query)}`, { method, headers, credentials: 'same-origin', body });
    } catch (error) {
      throw new Error(`Network error: ${(error as Error).message || 'could not reach the server'}`, { cause: error });
    }
    if (attempt >= RETRIES || !isGatewayFailure(res)) break;
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }

  if (!res.ok) {
    let body: ErrorBody | null = null;
    try {
      body = (await res.json()) as ErrorBody;
    } catch {
      body = null;
    }
    const error = toDomainError(res.status, body);
    // No session (401) or no membership yet (403 ACCESS_PENDING): the app routes the person to /sign-in or /access-pending
    const code = (error as { code?: string }).code;
    if (code === 'UNAUTHENTICATED') notifyAuthFailure('unauthenticated');
    else if (code === 'ACCESS_PENDING') notifyAuthFailure('access-pending');
    throw error;
  }
  if (o.blob) return (await res.blob()) as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
