import type { Context } from 'hono';
import { ValidationError } from '@/domain/errors';
import type { AppEnv } from '../env';

/**
 * A JSON object body whose keys are all on the route's list: an unknown key is a 422 naming it, never silently dropped
 * (a typo in a field name must not look like a save). The values are validated by the shared command with the zod schemas
 * of src/domain/schemas.ts.
 */
export async function readBody(c: Context<AppEnv>, allowed: readonly string[], options: { optional?: boolean } = {}): Promise<Record<string, any>> {
  const text = await c.req.text();
  if (!text.trim()) {
    if (options.optional) return {};
    throw new ValidationError({ body: ['Send a JSON body'] });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ValidationError({ body: ['The body is not valid JSON'] });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ValidationError({ body: ['The body must be a JSON object'] });
  const unknown = Object.keys(parsed).filter((k) => !allowed.includes(k));
  if (unknown.length > 0) throw new ValidationError(Object.fromEntries(unknown.map((k) => [k, ['This field is not accepted here']])));
  return parsed as Record<string, any>;
}

export const text = (value: unknown, field: string): string => {
  if (typeof value !== 'string') throw new ValidationError({ [field]: [`${field} is required`] });
  return value;
};
