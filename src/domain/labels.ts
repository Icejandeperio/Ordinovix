import type {
  LineStatus,
  TaskStatus,
  StatusGroup,
  VisitStatus,
  FollowUpState,
  Outcome,
  OutcomeCause,
  CopyForm,
  Supplier,
  Channel,
  FilingChannel,
  OfficeType,
  TaskKind,
  EntityType,
  VatStatus,
} from './types';

export interface StatusMeta {
  label: string;
  tone: 'neutral' | 'info' | 'warn' | 'serious' | 'critical' | 'good';
  icon: string;
  isBlocked?: boolean;
}

export const LINE_STATUS_META: Record<LineStatus, StatusMeta> = {
  not_requested: { label: 'Not requested', tone: 'neutral', icon: 'CircleDashed' },
  requested: { label: 'Requested', tone: 'info', icon: 'Send' },
  received: { label: 'Received — needs review', tone: 'warn', icon: 'Inbox' },
  under_review: { label: 'Under review', tone: 'warn', icon: 'ScanEye' },
  accepted: { label: 'Accepted', tone: 'good', icon: 'BadgeCheck' },
  incomplete: { label: 'Incomplete', tone: 'serious', icon: 'CircleAlert' },
  needs_correction: { label: 'Needs correction', tone: 'serious', icon: 'PencilLine' },
  not_applicable: { label: 'Not applicable', tone: 'neutral', icon: 'MinusCircle' },
};

export const TASK_STATUS_META: Record<TaskStatus, StatusMeta> = {
  intake: { label: 'Not started', tone: 'neutral', icon: 'CircleDot', isBlocked: true },
  waiting_on_client: { label: 'Waiting on client', tone: 'warn', icon: 'Lock', isBlocked: true },
  review_required: { label: 'Needs your review', tone: 'warn', icon: 'Lock', isBlocked: true },
  needs_correction: { label: 'Needs correction', tone: 'serious', icon: 'Lock', isBlocked: true },
  in_preparation: { label: 'In preparation', tone: 'info', icon: 'Pencil', isBlocked: false },
  ready_for_review: { label: 'Ready for review', tone: 'info', icon: 'UserCheck', isBlocked: false },
  ready_next_step: { label: 'Ready for next step', tone: 'good', icon: 'CircleCheck', isBlocked: false },
  submitted: { label: 'Submitted', tone: 'info', icon: 'Send', isBlocked: false },
  awaiting_follow_up: { label: 'Awaiting follow-up', tone: 'info', icon: 'Clock', isBlocked: false },
  completed: { label: 'Completed', tone: 'neutral', icon: 'CircleCheckBig', isBlocked: false },
  archived: { label: 'Archived', tone: 'neutral', icon: 'Archive', isBlocked: false },
};

export const STATUS_GROUP_LABELS: Record<StatusGroup, string> = {
  blocked: 'Blocked',
  in_progress: 'In progress',
  ready: 'Ready for next step',
  submitted: 'Submitted',
  done: 'Completed',
};

export const VISIT_STATUS_META: Record<VisitStatus, StatusMeta> = {
  planned: { label: 'Planned', tone: 'info', icon: 'Calendar' },
  in_progress: { label: 'In progress', tone: 'info', icon: 'MapPin' },
  done: { label: 'Done', tone: 'neutral', icon: 'BadgeCheck' },
  cancelled: { label: 'Cancelled', tone: 'neutral', icon: 'CircleSlash' },
};

export const FOLLOW_UP_STATE_META: Record<FollowUpState, StatusMeta> = {
  not_sent: { label: 'Not sent', tone: 'neutral', icon: 'Clock' },
  due_today: { label: 'Due today', tone: 'warn', icon: 'AlertCircle' },
  overdue: { label: 'Overdue', tone: 'critical', icon: 'AlertTriangle' },
  waiting: { label: 'Waiting', tone: 'info', icon: 'Hourglass' },
  escalated: { label: 'Escalated', tone: 'serious', icon: 'Flag' },
  resolved: { label: 'Resolved', tone: 'neutral', icon: 'CheckCircle2' },
};

export const OUTCOME_META: Record<Outcome, { label: string; tone: StatusMeta['tone'] }> = {
  completed: { label: 'Completed', tone: 'good' },
  submitted_pending: { label: 'Submitted, waiting for processing', tone: 'info' },
  paid_proof_pending: { label: 'Paid, proof to follow', tone: 'info' },
  more_documents_requested: { label: 'More documents requested', tone: 'serious' },
  correction_required: { label: 'Correction required', tone: 'serious' },
  not_accepted: { label: 'Not accepted', tone: 'critical' },
  follow_up_required: { label: 'Follow-up visit needed', tone: 'warn' },
};

export const OUTCOME_CAUSE_META: Record<OutcomeCause, { label: string; avoidable: boolean }> = {
  missing_document: { label: 'Missing document', avoidable: true },
  wrong_copy_form: { label: 'Wrong form of copy', avoidable: true },
  wrong_copy_count: { label: 'Wrong number of copies', avoidable: true },
  authorization_problem: { label: 'Authorization problem', avoidable: true },
  document_error: { label: 'Error in the documents', avoidable: true },
  unsigned_or_unnotarized: { label: 'Unsigned or not notarized', avoidable: true },
  office_system_down: { label: 'Office system down', avoidable: false },
  officer_unavailable: { label: 'Officer unavailable', avoidable: false },
  new_requirement: { label: 'New or changed requirement', avoidable: false },
  processing_time: { label: 'Processing time', avoidable: false },
  cutoff_reached: { label: 'Cut-off time reached', avoidable: false },
  other: { label: 'Other', avoidable: false },
};

export const COPY_FORM_LABELS: Record<CopyForm, string> = {
  original: 'Original',
  certified_true_copy: 'Certified copy',
  photocopy: 'Photocopy',
  digital: 'Digital',
};

export function copyFormLabel(form?: CopyForm): string {
  if (!form) return '';
  return COPY_FORM_LABELS[form] || form;
}


export const SUPPLIER_LABELS: Record<Supplier, string> = {
  client: 'Client',
  operator: 'Me (Preparer)',
  third_party: 'Third party',
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  viber: 'Viber',
  messenger: 'Messenger',
  sms: 'SMS',
  email: 'Email',
  phone: 'Phone call',
  in_person: 'In person',
};

export const FILING_CHANNEL_LABELS: Record<FilingChannel, string> = {
  efps: 'eFPS',
  ebirforms: 'eBIRForms',
  manual: 'Manual / Over-the-counter',
};

export const OFFICE_TYPE_LABELS: Record<OfficeType, string> = {
  rdo: 'BIR RDO',
  bank: 'Authorized Agent Bank (AAB)',
  lgu: 'City / Municipal Hall (LGU)',
  sec: 'Securities & Exchange Commission',
  client_office: 'Client office',
  other: 'Other office',
};

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  filing: 'Tax Return Filing',
  payment: 'Tax Payment',
  registration: 'Registration / Update',
  one_time_transaction: 'One-Time Transaction (ONETT)',
  lgu: 'LGU / Mayor Permit',
  other: 'Other errand',
};

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  gpp: 'General Professional Partnership (GPP)',
  solo: 'Sole Proprietor / Freelancer',
  other: 'Corporation / Other',
};

export const VAT_STATUS_LABELS: Record<VatStatus, string> = {
  vat: 'VAT Registered',
  non_vat_percentage: 'Non-VAT (Percentage Tax)',
  non_vat_8pct: 'Non-VAT (8% Flat Rate)',
  unknown: 'To be verified',
};
