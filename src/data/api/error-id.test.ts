import { describe, expect, it, vi } from 'vitest';
import { errorIdOf } from '@/lib/error-id';
import { request } from './http';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('U42 a server fault carries its error ID', () => {
  it('puts the ID in the message and on the error', async () => {
    const fetchImpl = vi.fn(async () => json(500, { error: { code: 'INTERNAL', message: 'Something went wrong on our side.', errorId: 'abc-123' } }));
    const error = await request('PATCH', '/api/v1/payments/p1', { body: {}, ifMatch: 1, fetchImpl: fetchImpl as unknown as typeof fetch, bootstrap: true }).catch((e: unknown) => e);
    expect((error as Error).message).toContain('Error ID: abc-123');
    expect(errorIdOf(error)).toBe('abc-123');
  });

  it('leaves other errors without an ID', async () => {
    const fetchImpl = vi.fn(async () => json(422, { error: { code: 'VALIDATION', message: 'Bad', fields: { x: ['Bad'] } } }));
    const error = await request('PATCH', '/api/v1/payments/p1', { body: {}, ifMatch: 1, fetchImpl: fetchImpl as unknown as typeof fetch, bootstrap: true }).catch((e: unknown) => e);
    expect(errorIdOf(error)).toBeUndefined();
  });
});
