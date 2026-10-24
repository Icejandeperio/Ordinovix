import { z } from 'zod';

export const ClientSchema = z.object({
  code: z.string().min(2, 'Code must be at least 2 characters').max(6, 'Code cannot exceed 6 characters').toUpperCase(),
  displayName: z.string().min(2, 'Name is required'),
  registeredName: z.string().optional(),
  entityType: z.enum(['gpp', 'solo', 'other']),
  hasTin: z.boolean().default(true),
  tin: z.string().optional(),
  rdoCode: z.string().min(2, 'RDO code is required'),
  vatStatus: z.enum(['vat', 'non_vat_percentage', 'non_vat_8pct', 'unknown']),
  sizeClass: z.enum(['micro', 'small', 'medium', 'large', 'unknown']).default('micro'),
  filingChannel: z.enum(['efps', 'ebirforms', 'manual']).optional(),
  efpsGroup: z.enum(['A', 'B', 'C', 'D', 'E']).optional(),
  orusEnrolled: z.boolean().default(false),
  accessHolder: z.enum(['client', 'operator', 'other', 'unknown']).default('unknown'),
  usesInvoicingSoftware: z.boolean().default(false),
  fiscalYearEndMonth: z.number().int().min(1).max(12).default(12),
  preferredLanguage: z.enum(['en', 'fil']).default('en'),
  assignedUserIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const ContactSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(2, 'Contact name is required'),
  title: z.enum(['Atty.', 'Mr.', 'Ms.']).optional(),
  role: z.string().optional(),
  phoneE164: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  preferredChannel: z.enum(['viber', 'messenger', 'sms', 'email', 'phone', 'in_person']).default('viber'),
  language: z.enum(['en', 'fil']).default('en'),
  isSignatory: z.boolean().default(false),
  notes: z.string().optional(),
});

export const AuthorizationSchema = z.object({
  clientId: z.string().min(1),
  type: z.enum(['spa', 'authorization_letter', 'secretary_certificate', 'partnership_resolution', 'other']),
  scope: z.array(z.enum(['filing', 'payment', 'registration', 'one_time_transaction', 'lgu', 'other'])).min(1, 'Select at least one scope'),
  granteeUserId: z.string().min(1, 'Grantee user is required'),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional().or(z.literal('')),
  notarized: z.boolean().default(false),
  notes: z.string().optional(),
});

export const TaskSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  templateId: z.string().optional(),
  title: z.string().optional(),
  kind: z.enum(['filing', 'payment', 'registration', 'one_time_transaction', 'lgu', 'other']),
  period: z.string().optional(),
  transactionDate: z.string().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD'),
  ownerUserId: z.string().min(1, 'Task owner is required'),
  officeAction: z.boolean().default(false),
  paymentExpected: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const VisitSchema = z.object({
  officeId: z.string().optional(),
  officeType: z.enum(['rdo', 'bank', 'lgu', 'sec', 'client_office', 'other']),
  officeName: z.string().min(2, 'Office name is required'),
  rdoCode: z.string().optional(),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Planned date must be YYYY-MM-DD'),
  arriveBy: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm').optional().or(z.literal('')),
  assigneeUserId: z.string().min(1, 'Assignee is required'),
  purpose: z.string().optional(),
});

export const PaymentSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  taskId: z.string().min(1, 'Task is required'),
  amount: z.number().int().positive('Amount must be positive centavos'),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  channel: z.enum(['aab_otc', 'rco', 'online', 'other']),
  provider: z.string().optional(),
  referenceNo: z.string().optional(),
  paidBy: z.enum(['client', 'operator']),
  note: z.string().optional(),
});

export const OutcomeSchema = z.object({
  outcome: z.enum([
    'completed',
    'submitted_pending',
    'paid_proof_pending',
    'more_documents_requested',
    'correction_required',
    'not_accepted',
    'follow_up_required',
  ]),
  cause: z.enum([
    'missing_document',
    'wrong_copy_form',
    'wrong_copy_count',
    'authorization_problem',
    'document_error',
    'unsigned_or_unnotarized',
    'office_system_down',
    'officer_unavailable',
    'new_requirement',
    'processing_time',
    'cutoff_reached',
    'other',
  ]).optional(),
  avoidable: z.boolean().optional(),
  note: z.string().optional(),
  windowOrOfficer: z.string().optional(),
  nextActionText: z.string().optional(),
});
