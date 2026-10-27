import { z } from 'zod';
import { ValidationError, type FieldErrors } from './errors';
import { todayInManila } from '@/lib/dates';

/**
 * Write schemas (spec section 12). The mock repository parses every write with these at its boundary, and the
 * API will reuse them unchanged. Each schema matches what the repository method accepts: updates send only the
 * changed fields, creates must carry the required ones (checked with `requireOnCreate`).
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const CHANNELS = ['viber', 'messenger', 'sms', 'email', 'phone', 'in_person'] as const;
const TASK_KINDS = ['filing', 'payment', 'registration', 'one_time_transaction', 'lgu', 'other'] as const;
const OFFICE_TYPES = ['rdo', 'bank', 'lgu', 'sec', 'client_office', 'other'] as const;

/** YYYY-MM-DD. */
export const dateField = (label = 'Date') => z.string().regex(DATE, `${label} must be YYYY-MM-DD`);
/** A date that cannot be in the future ("paid on", "received on"). */
export const pastDateField = (label = 'Date') =>
  dateField(label).refine((d) => d <= todayInManila(), `${label} cannot be in the future`);
/** Reason fields: trimmed, at least 10 characters, at most 500. */
export const reasonField = (label = 'Reason') =>
  z.string().trim().min(10, `${label} must be at least 10 characters`).max(500, `${label} cannot exceed 500 characters`);
/** Names and labels: 2 to 120 characters, no leading or trailing spaces. */
export const nameField = (label = 'Name') =>
  z
    .string()
    .min(2, `${label} must be at least 2 characters`)
    .max(120, `${label} cannot exceed 120 characters`)
    .refine((v) => v === v.trim(), `${label} cannot start or end with a space`);
/** https:// URLs only. */
export const httpsUrlField = (label = 'Link') =>
  z.string().url(`${label} must be a valid link`).refine((u) => u.startsWith('https://'), `${label} must start with https://`);

/** Required-on-create check: a write without an `id` is a create and must carry these fields. */
const requireOnCreate =
  (fields: string[], labels: Record<string, string> = {}) =>
  (data: Record<string, unknown>, ctx: z.RefinementCtx) => {
    if (data.id) return;
    for (const f of fields) {
      const v = data[f];
      if (v === undefined || v === null || v === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [f], message: `${labels[f] ?? f} is required` });
      }
    }
  };

export const ClientWriteSchema = z
  .object({
    id: z.string().optional(),
    code: z.string().regex(/^[A-Z0-9-]{2,6}$/, 'Code must be 2 to 6 uppercase letters, digits or hyphens').optional(),
    displayName: nameField('Name').optional(),
    registeredName: z.string().max(120, 'Registered name cannot exceed 120 characters').optional(),
    entityType: z.enum(['gpp', 'solo', 'other']).optional(),
    rdoCode: z.string().min(2, 'RDO is required').max(12).optional(),
    vatStatus: z.enum(['vat', 'non_vat_percentage', 'non_vat_8pct', 'unknown']).optional(),
    sizeClass: z.enum(['micro', 'small', 'medium', 'large', 'unknown']).optional(),
    filingChannel: z.enum(['efps', 'ebirforms', 'manual']).optional(),
    efpsGroup: z.enum(['A', 'B', 'C', 'D', 'E']).optional(),
    fiscalYearEndMonth: z.number().int().min(1, 'Month must be 1 to 12').max(12, 'Month must be 1 to 12').optional(),
    preferredLanguage: z.enum(['en', 'fil']).optional(),
  })
  .superRefine(requireOnCreate(['displayName', 'code', 'entityType', 'rdoCode'], { displayName: 'Name', code: 'Code', entityType: 'Entity type', rdoCode: 'RDO' }));

export const ContactWriteSchema = z
  .object({
    id: z.string().optional(),
    clientId: z.string().min(1, 'Client is required').optional(),
    name: nameField('Contact name').optional(),
    title: z.enum(['Atty.', 'Mr.', 'Ms.']).optional(),
    email: z.string().email('Enter a valid email address').or(z.literal('')).optional(),
    phoneE164: z.string().max(20, 'Phone number is too long').optional(),
    preferredChannel: z.enum(CHANNELS).optional(),
    language: z.enum(['en', 'fil']).optional(),
    notes: z.string().max(300, 'Notes cannot exceed 300 characters').optional(),
  })
  .superRefine(requireOnCreate(['clientId', 'name'], { clientId: 'Client', name: 'Contact name' }));

export const AuthorizationWriteSchema = z
  .object({
    id: z.string().optional(),
    clientId: z.string().min(1, 'Client is required').optional(),
    type: z.enum(['spa', 'authorization_letter', 'secretary_certificate', 'partnership_resolution', 'other']).optional(),
    scope: z.array(z.enum(['filing', 'payment', 'registration', 'one_time_transaction', 'lgu', 'other'])).min(1, 'Select at least one scope').optional(),
    granteeUserId: z.string().min(1, 'Authorized representative is required').optional(),
    issuedOn: dateField('Date of issuance').optional(),
    validUntil: dateField('Valid until').or(z.literal('')).optional(),
  })
  .superRefine(requireOnCreate(['clientId', 'type', 'scope', 'granteeUserId', 'issuedOn'], { clientId: 'Client', type: 'Type', scope: 'Scope', granteeUserId: 'Authorized representative', issuedOn: 'Date of issuance' }))
  .superRefine((a, ctx) => {
    if (a.issuedOn && a.validUntil && a.validUntil < a.issuedOn) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['validUntil'], message: 'Valid until cannot be before the date of issuance' });
    }
  });

export const TaskCreateSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  kind: z.enum(TASK_KINDS).optional(),
  title: z.string().max(120, 'Title cannot exceed 120 characters').optional(),
  dueDate: dateField('Due date').optional(),
  transactionDate: dateField('Transaction date').optional(),
  ownerUserId: z.string().min(1).optional(),
});

export const ChangeDueSchema = z.object({
  dueDate: dateField('New due date'),
  ref: z.string().trim().min(1, 'Source reference is required').max(120, 'Source reference cannot exceed 120 characters'),
  reason: reasonField(),
  url: httpsUrlField('Source link').optional(),
});

export const VisitWriteSchema = z.object({
  plannedDate: dateField('Planned date').optional(),
  arriveBy: z.string().regex(TIME, 'Time must be HH:mm').or(z.literal('')).optional(),
  officeName: nameField('Office name').optional(),
  purpose: z.string().max(300, 'Purpose cannot exceed 300 characters').optional(),
});

export const VisitItemWriteSchema = z.object({
  questions: z.string().max(1000, 'Questions cannot exceed 1000 characters').optional(),
});

export const PaymentWriteSchema = z
  .object({
    id: z.string().optional(),
    clientId: z.string().min(1, 'Client is required').optional(),
    taskId: z.string().min(1, 'Task is required').optional(),
    amount: z.number().int('Amount must be whole centavos').min(1, 'Amount must be greater than zero').optional(),
    paidOn: pastDateField('Paid on').optional(),
    channel: z.enum(['aab_otc', 'rco', 'online', 'other']).optional(),
    paidBy: z.enum(['client', 'operator']).optional(),
    provider: z.string().max(120).optional(),
    referenceNo: z.string().max(60, 'Reference number cannot exceed 60 characters').optional(),
    note: z.string().max(300, 'Note cannot exceed 300 characters').optional(),
  })
  .superRefine(requireOnCreate(['clientId', 'taskId', 'amount', 'paidOn', 'channel', 'paidBy'], { clientId: 'Client', taskId: 'Task', amount: 'Amount', paidOn: 'Paid on', channel: 'Channel', paidBy: 'Paid by' }));

export const OutcomeWriteSchema = z.object({
  outcome: z.enum(['completed', 'submitted_pending', 'paid_proof_pending', 'more_documents_requested', 'correction_required', 'not_accepted', 'follow_up_required']),
  note: z.string().max(300, 'Note cannot exceed 300 characters').optional(),
  windowOrOfficer: z.string().max(120).optional(),
});

export const FollowUpCreateSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  channel: z.enum(CHANNELS).optional(),
  expectedBy: dateField('Expected by').optional(),
});

export const MarkSentWriteSchema = z.object({
  channel: z.enum(CHANNELS),
  sentAt: z.string().min(1, 'Sent time is required'),
  expectedBy: dateField('Expected by'),
  message: z.string().min(1, 'Message is required').max(2000, 'Message cannot exceed 2000 characters'),
});

export const LogResponseWriteSchema = z.object({
  text: z.string().trim().min(1, 'Response text is required').max(1000, 'Response cannot exceed 1000 characters'),
});

export const OfficeWriteSchema = z.object({
  name: nameField('Office name').optional(),
  type: z.enum(OFFICE_TYPES).optional(),
  mapUrl: httpsUrlField('Map link').or(z.literal('')).optional(),
  tips: z.string().max(1000, 'Tips cannot exceed 1000 characters').optional(),
});

export const HolidayWriteSchema = z.object({
  date: dateField('Date').optional(),
  name: nameField('Holiday name').optional(),
  type: z.enum(['regular', 'special_non_working', 'local', 'office_closure']).optional(),
});

export const DeadlineMoveWriteSchema = z.object({
  period: z.string().min(1, 'Period is required').optional(),
  newDueDate: dateField('New due date').optional(),
  sourceRef: z.string().trim().min(1, 'Source reference is required').max(120).optional(),
});

export const MembershipInviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  role: z.enum(['owner', 'helper']),
});

export const NoteWriteSchema = z.object({
  entity: z.enum(['client', 'task', 'visit']).optional(),
  body: z.string().trim().min(1, 'Note cannot be empty').max(2000, 'Note cannot exceed 2000 characters'),
});

export const TaskUpdateSchema = z.object({
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional(),
});

export const MarkSubmittedSchema = z.object({
  on: dateField('Submitted on'),
  via: z.enum(['efps', 'ebirforms', 'manual', 'office']),
  ref: z.string().max(60, 'Reference number cannot exceed 60 characters').optional(),
  note: z.string().max(300, 'Note cannot exceed 300 characters').optional(),
});

export const MarkCompletedSchema = z.object({
  on: dateField('Completed on'),
  noEvidenceReason: z.string().trim().min(10, 'Reason must be at least 10 characters').max(500).optional(),
});

export const NextActionSchema = z.object({
  text: z.string().trim().min(1, 'Next action is required').max(200, 'Next action cannot exceed 200 characters'),
  owner: z.enum(['client', 'operator', 'third_party']),
  due: dateField('Due date').optional(),
});

export const LineStatusExtraSchema = z.object({
  note: z.string().trim().min(3, 'Note must be at least 3 characters').max(200, 'Note cannot exceed 200 characters').optional(),
  reason: reasonField().optional(),
  on: dateField('Date').optional(),
});

export const LineWriteSchema = z.object({
  label: nameField('Requirement name').optional(),
  copies: z.number().int().min(1, 'Copies must be at least 1').max(99).optional(),
  reviewNote: z.string().max(300, 'Note cannot exceed 300 characters').optional(),
});

const DOCUMENT_KINDS = ['source', 'filed_return', 'acknowledgment', 'payment_proof', 'stamped_copy', 'ecar', 'authorization', 'other'] as const;
export const DocumentMetaSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  kind: z.enum(DOCUMENT_KINDS),
});
export const DocumentUpdateSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS).optional(),
});

export const TemplateWriteSchema = z.object({
  name: nameField('Template name').optional(),
  code: z.string().min(2, 'Code must be at least 2 characters').max(24).optional(),
});

export const MarkVerifiedSchema = z.object({
  sourceRef: z.string().trim().min(1, 'Source reference is required').max(200),
  sourceUrl: httpsUrlField('Source link').or(z.literal('')).optional(),
  verifiedOn: dateField('Verified on'),
});

export const SettingsWriteSchema = z.object({
  practiceName: nameField('Practice name').optional(),
  operatorDisplayName: nameField('Display name').optional(),
  dueSoonDays: z.number().int().min(1).max(60).optional(),
  followUpWaitDays: z.number().int().min(1).max(30).optional(),
});

export const MessageWriteSchema = z.object({
  name: nameField('Template name').optional(),
  body: z.string().min(1, 'Message is required').max(2000, 'Message cannot exceed 2000 characters').optional(),
});

export const VisitAddItemSchema = z.object({ action: z.enum(['submit', 'pay', 'claim', 'inquire', 'follow_up']) });

export const FinishVisitSchema = z.object({
  finishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'Finish time must be a valid date and time'),
  costs: z
    .object({
      transport: z.number().int().min(0).optional(),
      parking: z.number().int().min(0).optional(),
      other: z.number().int().min(0).optional(),
      note: z.string().max(300).optional(),
    })
    .optional(),
});

export const VisitKitWriteSchema = z.object({
  label: nameField('Item name').optional(),
});

export const BaselineWriteSchema = z.object({
  periodStart: dateField('Period start').optional(),
  periodEnd: dateField('Period end').optional(),
});

export const PulseWriteSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM').optional(),
});

/** A reason argument (archive, restore, override, cancel, remove, escalate, resolve ...). */
export const ReasonSchema = reasonField();

function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Parse at the repository boundary. Throws VALIDATION with the messages per field; never changes the input. */
export function validate(schema: z.ZodTypeAny, input: unknown): void {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(fieldErrorsFrom(result.error));
}

/** Validate a single reason argument; the field name shown is "reason". */
export function validateReason(reason: unknown, label = 'Reason'): void {
  const result = reasonField(label).safeParse(reason);
  if (!result.success) throw new ValidationError({ reason: result.error.issues.map((i) => i.message) });
}
