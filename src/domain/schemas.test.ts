import { describe, it, expect } from 'vitest';
import {
  ClientWriteSchema,
  ContactWriteSchema,
  AuthorizationWriteSchema,
  PaymentWriteSchema,
  ChangeDueSchema,
  OfficeWriteSchema,
  ReasonSchema,
  validate,
  validateReason,
} from './schemas';
import { ValidationError, fieldMessages } from './errors';

const errorsOf = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return e as ValidationError;
  }
  throw new Error('expected a ValidationError');
};

describe('domain/schemas (spec section 12 rules)', () => {
  it('reasons are trimmed, at least 10 and at most 500 characters', () => {
    expect(ReasonSchema.safeParse('too short').success).toBe(false);
    expect(ReasonSchema.safeParse('   ok      ').success).toBe(false);
    expect(ReasonSchema.safeParse('Client confirmed by phone').success).toBe(true);
    expect(ReasonSchema.safeParse('x'.repeat(501)).success).toBe(false);
  });

  it('a client needs name, code, entity type and RDO on create, but an update may send just the changed field', () => {
    const create = errorsOf(() => validate(ClientWriteSchema, { displayName: 'R' }));
    expect(Object.keys(create.fieldErrors).sort()).toEqual(['code', 'displayName', 'entityType', 'rdoCode']);
    expect(() => validate(ClientWriteSchema, { id: 'client-rsp', rdoCode: '040' })).not.toThrow();
    expect(() => validate(ClientWriteSchema, { displayName: 'Reyes Law', code: 'RYL', entityType: 'solo', rdoCode: '039' })).not.toThrow();
  });

  it('client codes are 2 to 6 uppercase letters, digits or hyphens and names have no outer spaces', () => {
    expect(ClientWriteSchema.safeParse({ id: 'c', code: 'rsp' }).success).toBe(false);
    expect(ClientWriteSchema.safeParse({ id: 'c', code: 'TOOLONGCODE' }).success).toBe(false);
    expect(ClientWriteSchema.safeParse({ id: 'c', displayName: ' Padded ' }).success).toBe(false);
    expect(ClientWriteSchema.safeParse({ id: 'c', fiscalYearEndMonth: 13 }).success).toBe(false);
  });

  it('contacts need a valid email when one is given', () => {
    expect(ContactWriteSchema.safeParse({ clientId: 'c', name: 'Ana', email: 'not-an-email' }).success).toBe(false);
    expect(ContactWriteSchema.safeParse({ clientId: 'c', name: 'Ana', email: '' }).success).toBe(true);
  });

  it('authorizations need at least one scope, ISO dates and a valid-until on or after the issue date', () => {
    const base = { clientId: 'c', type: 'spa', granteeUserId: 'u', scope: ['filing'], issuedOn: '2026-10-01' };
    expect(AuthorizationWriteSchema.safeParse({ ...base, scope: [] }).success).toBe(false);
    expect(AuthorizationWriteSchema.safeParse({ ...base, issuedOn: '10/01/2026' }).success).toBe(false);
    expect(AuthorizationWriteSchema.safeParse({ ...base, validUntil: '2026-09-30' }).success).toBe(false);
    expect(AuthorizationWriteSchema.safeParse({ ...base, validUntil: '2027-09-30' }).success).toBe(true);
  });

  it('payments are whole centavos above zero, paid on a date that is not in the future', () => {
    const base = { clientId: 'c', taskId: 't', amount: 150000, paidOn: '2026-10-20', channel: 'online', paidBy: 'client' };
    expect(PaymentWriteSchema.safeParse(base).success).toBe(true);
    expect(PaymentWriteSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(PaymentWriteSchema.safeParse({ ...base, amount: 12.5 }).success).toBe(false);
    expect(PaymentWriteSchema.safeParse({ ...base, paidOn: '2999-01-01' }).success).toBe(false);
    expect(PaymentWriteSchema.safeParse({ ...base, note: 'x'.repeat(301) }).success).toBe(false);
  });

  it('a due-date change needs a source reference and a reason, and links must be https', () => {
    const base = { dueDate: '2026-12-31', ref: 'RMC 30-2026', reason: 'Extended by the issuance' };
    expect(ChangeDueSchema.safeParse(base).success).toBe(true);
    expect(ChangeDueSchema.safeParse({ ...base, ref: '' }).success).toBe(false);
    expect(ChangeDueSchema.safeParse({ ...base, url: 'http://example.com' }).success).toBe(false);
    expect(OfficeWriteSchema.safeParse({ mapUrl: 'http://maps.example.com' }).success).toBe(false);
    expect(OfficeWriteSchema.safeParse({ mapUrl: 'https://maps.example.com' }).success).toBe(true);
  });

  it('validate throws VALIDATION with the messages per field, and never changes the input', () => {
    const input = { clientId: 'c', taskId: 't', amount: 0, paidOn: 'bad', channel: 'online', paidBy: 'client' };
    const err = errorsOf(() => validate(PaymentWriteSchema, input));
    expect(err.code).toBe('VALIDATION');
    expect(err.fieldErrors.amount[0]).toMatch(/greater than zero/);
    expect(err.fieldErrors.paidOn[0]).toMatch(/YYYY-MM-DD/);
    expect(input.amount).toBe(0);
    expect(fieldMessages(err)).toEqual({ amount: err.fieldErrors.amount[0], paidOn: err.fieldErrors.paidOn[0] });
    expect(fieldMessages(new Error('other'))).toBeNull();
  });

  it('validateReason reports the problem under "reason"', () => {
    const err = errorsOf(() => validateReason('short'));
    expect(Object.keys(err.fieldErrors)).toEqual(['reason']);
  });
});
