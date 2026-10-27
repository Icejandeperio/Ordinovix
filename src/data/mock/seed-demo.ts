import type {
  Office,
  Client,
  Contact,
  Authorization,
  TaskTemplate,
  RequirementTemplate,
  Task,
  TaskLine,
  TaskStatus,
  LineStatus,
  Supplier,
  CopyForm,
  TaskKind,
  Channel,
  Visit,
  VisitItem,
  VisitAction,
  Outcome,
  OutcomeCause,
  FollowUp,
  FollowUpAttempt,
  Payment,
  PaymentChannel,
  DocumentFile,
  DocumentKind,
  Notification,
  NotificationType,
  Note,
  ActivityEvent,
  Baseline,
  Pulse,
  Holiday,
  DeadlineMove,
  ID,
  ISODate,
} from '@/domain/types';
import { addDaysToDate } from '@/lib/dates';
import { nonWorkingDayNote } from '@/domain/rules';
import { mulberry32 } from './seed';

/**
 * Spec section 18 demo data, added around the base seed. Deterministic (mulberry32 seed 20261024) and
 * relative to the seed day D, so overdue and due-soon states never go stale. Every sample template is unverified.
 * Existing seed ids (users, clients, tasks, visit-today, ...) are never changed; this only adds records.
 */
export interface DemoData {
  offices: Office[];
  clients: Client[];
  contacts: Contact[];
  authorizations: Authorization[];
  templates: TaskTemplate[];
  reqTemplates: RequirementTemplate[];
  tasks: Task[];
  taskLines: TaskLine[];
  visits: Visit[];
  visitItems: VisitItem[];
  followUps: FollowUp[];
  followUpAttempts: FollowUpAttempt[];
  payments: Payment[];
  documents: DocumentFile[];
  notifications: Notification[];
  notes: Note[];
  activity: ActivityEvent[];
  baseline: Baseline;
  pulses: Pulse[];
  holidays: Holiday[];
  deadlineMoves: DeadlineMove[];
}

const SEED = 20261024;
const ANA = 'user-ana';
const BEN = 'user-ben';

const at = (date: ISODate, time = '09:00:00') => `${date}T${time}+08:00`;

/** Calendar-date arithmetic on YYYY-MM-DD strings (no timezone shifting). */
function shiftMonth(date: ISODate, months: number): { year: number; month: number } {
  const [y, m] = date.split('-').map(Number);
  const idx = y * 12 + (m - 1) + months;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}
const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

export function buildDemoData(orgId: string, baseDate: ISODate, existingHolidays: Holiday[]): DemoData {
  const rand = mulberry32(SEED);
  const meta = (date: ISODate, by: ID = ANA) => ({
    orgId,
    createdAt: at(date),
    createdBy: by,
    updatedAt: at(date),
    updatedBy: by,
    version: 1,
  });
  const D = baseDate;
  const rel = (days: number) => addDaysToDate(D, days);

  // ---------- Holidays (fixed-date samples only) and a sample deadline move ----------
  const sampleRef = 'Sample — replace with the official proclamation';
  const newHolidays: Holiday[] = [
    ['2026-05-01', 'Labor Day', 'regular'],
    ['2026-06-12', 'Independence Day', 'regular'],
    ['2026-08-21', 'Ninoy Aquino Day', 'special_non_working'],
    ['2026-12-08', 'Feast of the Immaculate Conception', 'special_non_working'],
    ['2027-01-01', "New Year's Day", 'regular'],
  ].map(([date, name, type], i) => ({
    id: `hol-demo-${i + 1}`,
    date,
    name,
    type: type as Holiday['type'],
    sourceRef: sampleRef,
    ...meta(D),
  }));
  const holidays = [...existingHolidays, ...newHolidays];
  const isWorkingDay = (date: ISODate) => nonWorkingDayNote(date, holidays) === null;
  const nextWorkingDay = (date: ISODate) => {
    let d = addDaysToDate(date, 1);
    while (!isWorkingDay(d)) d = addDaysToDate(d, 1);
    return d;
  };
  const workingOnOrAfter = (date: ISODate) => {
    let d = date;
    while (!isWorkingDay(d)) d = addDaysToDate(d, 1);
    return d;
  };
  const workingOnOrBefore = (date: ISODate) => {
    let d = date;
    while (!isWorkingDay(d)) d = addDaysToDate(d, -1);
    return d;
  };

  const deadlineMoves: DeadlineMove[] = [
    {
      id: 'dm-demo-1702ex',
      templateId: 'tmpl-1702ex',
      period: '2025',
      newDueDate: '2026-05-15',
      sourceRef: 'RMC 30-2026',
      note: 'Sample only: check whether the issuance covers this form before using it for real.',
      ...meta(D),
    },
  ];

  // ---------- Offices ----------
  const offices: Office[] = [
    {
      id: 'off-rdo40',
      type: 'rdo',
      name: 'RDO 040 — Sample District B',
      rdoCode: '040',
      address: 'Sample address B, Metro Manila',
      hours: '8:00 AM – 5:00 PM',
      isSample: true,
      ...meta(D),
    },
    {
      id: 'off-sec',
      type: 'sec',
      name: 'SEC Satellite Office (sample)',
      address: 'Sample address, Metro Manila',
      hours: '8:00 AM – 5:00 PM',
      isSample: true,
      ...meta(D),
    },
  ];

  // ---------- Clients, contacts, authorizations ----------
  const clientBase = {
    sizeClass: 'small' as const,
    orusEnrolled: false,
    accessHolder: 'client' as const,
    usesInvoicingSoftware: false,
    fiscalYearEndMonth: 12,
    rdoCode: '039',
    rdoOfficeId: 'off-rdo39',
    tags: [] as string[],
  };
  const clients: Client[] = [
    {
      ...clientBase,
      id: 'client-vtl',
      code: 'VTL',
      displayName: 'Villanueva Tan Law',
      registeredName: 'Villanueva Tan Law Offices GPP',
      entityType: 'gpp',
      hasTin: true,
      tinMasked: '•••-•••-221-00000',
      tinFull: '301-114-221-00000',
      vatStatus: 'non_vat_percentage',
      filingChannel: 'ebirforms',
      preferredLanguage: 'fil',
      assignedUserIds: [ANA],
      tags: ['SPA expired'],
      status: 'active',
      ...meta(D),
    },
    {
      ...clientBase,
      id: 'client-bol',
      code: 'BOL',
      displayName: 'Bautista Ocampo Legal',
      registeredName: 'Bautista Ocampo Legal Partners GPP',
      entityType: 'gpp',
      hasTin: true,
      tinMasked: '•••-•••-637-00000',
      tinFull: '411-205-637-00000',
      vatStatus: 'vat',
      filingChannel: 'efps',
      efpsGroup: 'A',
      orusEnrolled: true,
      accessHolder: 'operator',
      preferredLanguage: 'en',
      assignedUserIds: [ANA],
      tags: ['eCAR'],
      status: 'active',
      ...meta(D),
    },
    {
      ...clientBase,
      id: 'client-amd',
      code: 'AMD',
      displayName: 'Atty. Andrea Mendoza',
      entityType: 'solo',
      hasTin: false,
      vatStatus: 'unknown',
      sizeClass: 'unknown',
      filingChannel: 'ebirforms',
      accessHolder: 'unknown',
      preferredLanguage: 'en',
      assignedUserIds: [ANA],
      tags: ['New', 'Imported'],
      notes: 'New client from import; TIN missing; VAT status unknown.',
      status: 'active',
      ...meta(D),
    },
    {
      ...clientBase,
      id: 'client-jra',
      code: 'JRA',
      displayName: 'Atty. Jose Ramos',
      entityType: 'solo',
      hasTin: true,
      tinMasked: '•••-•••-518-00000',
      tinFull: '502-771-518-00000',
      vatStatus: 'non_vat_percentage',
      filingChannel: 'ebirforms',
      preferredLanguage: 'en',
      assignedUserIds: [ANA],
      status: 'archived',
      archivedReason: 'Closed his practice; history only',
      ...meta(rel(-120)),
    },
  ];

  const contactDefs: Array<[string, string, string, string, Channel, 'en' | 'fil', boolean]> = [
    ['con-vtl-1', 'client-vtl', 'Atty. Rowena Villanueva', 'Partner', 'viber', 'fil', true],
    ['con-vtl-2', 'client-vtl', 'Liza Tan', 'Office manager', 'sms', 'fil', false],
    ['con-bol-1', 'client-bol', 'Atty. Bautista', 'Managing partner', 'email', 'en', true],
    ['con-bol-2', 'client-bol', 'Marco Ocampo', 'Paralegal', 'messenger', 'en', false],
    ['con-amd-1', 'client-amd', 'Atty. Andrea Mendoza', 'Owner', 'viber', 'en', true],
    ['con-jra-1', 'client-jra', 'Atty. Jose Ramos', 'Owner', 'email', 'en', true],
  ];
  const contacts: Contact[] = contactDefs.map(([id, clientId, name, role, preferredChannel, language, isSignatory]) => ({
    id,
    clientId,
    name,
    role,
    preferredChannel,
    language,
    isSignatory,
    ...meta(D),
  }));

  const authorizations: Authorization[] = [
    {
      id: 'auth-vtl-spa',
      clientId: 'client-vtl',
      type: 'spa',
      scope: ['filing', 'registration', 'lgu'],
      granteeUserId: ANA,
      issuedOn: rel(-370),
      validUntil: rel(-9), // expired 9 days ago; blocks V1's VTL item
      notarized: true,
      ...meta(D),
    },
    {
      id: 'auth-bol-spa',
      clientId: 'client-bol',
      type: 'spa',
      scope: ['filing', 'registration', 'one_time_transaction', 'lgu'],
      granteeUserId: ANA,
      issuedOn: rel(-90),
      validUntil: rel(275),
      notarized: true,
      ...meta(D),
    },
    {
      id: 'auth-maria-letter',
      clientId: 'client-maria',
      type: 'authorization_letter',
      scope: ['filing'],
      granteeUserId: ANA,
      issuedOn: rel(-353),
      validUntil: rel(12), // expiring in 12 days
      notarized: false,
      ...meta(D),
    },
    {
      id: 'auth-hlc-spa',
      clientId: 'client-horizon',
      type: 'spa',
      scope: ['filing', 'registration', 'one_time_transaction', 'lgu', 'payment'],
      granteeUserId: ANA,
      issuedOn: rel(-60),
      validUntil: rel(300),
      notarized: true,
      ...meta(D),
    },
  ];

  // ---------- Templates (spec 18.4; all unverified) ----------
  type ReqDef = [string, Supplier, CopyForm, number?];
  const tmplDefs: Array<{
    id: string; code: string; name: string; kind: TaskKind; frequency: TaskTemplate['frequency'];
    officeAction: boolean; office?: Office['type']; action?: VisitAction; payment: boolean;
    due?: TaskTemplate['defaultDue']; lines: ReqDef[];
  }> = [
    { id: 'tmpl-1601eq', code: 'BIR 1601-EQ', name: 'Quarterly expanded withholding with payee list', kind: 'filing', frequency: 'quarterly', officeAction: false, payment: true, due: { kind: 'days_after_period_end', value: 30 }, lines: [['Quarterly payee data', 'client', 'digital'], ['Monthly confirmations', 'operator', 'digital']] },
    { id: 'tmpl-2551q', code: 'BIR 2551-Q', name: 'Quarterly percentage tax', kind: 'filing', frequency: 'quarterly', officeAction: false, payment: true, due: { kind: 'days_after_period_end', value: 25 }, lines: [['Sales summary', 'client', 'digital']] },
    { id: 'tmpl-2307col', code: '2307-COL', name: 'Collect certificates of tax withheld', kind: 'other', frequency: 'quarterly', officeAction: false, payment: false, due: { kind: 'days_after_period_end', value: 20 }, lines: [["2307s from the firm's payors", 'client', 'original']] },
    { id: 'tmpl-1702ex', code: 'BIR 1702-EX', name: 'Annual information return (GPP)', kind: 'filing', frequency: 'annual', officeAction: false, payment: false, lines: [['Audited statements', 'third_party', 'digital'], ["Partners' share schedule", 'client', 'digital']] },
    { id: 'tmpl-ecar', code: 'ECAR-SALE', name: 'eCAR — sale of real property', kind: 'one_time_transaction', frequency: 'one_off', officeAction: true, office: 'rdo', action: 'submit', payment: true, lines: [['Deed of sale', 'client', 'certified_true_copy', 2], ['Title', 'client', 'certified_true_copy'], ['Tax declaration', 'client', 'certified_true_copy'], ['IDs of parties', 'client', 'photocopy', 2], ['Authority to transact', 'operator', 'original'], ['Tax payment proof', 'operator', 'original']] },
    { id: 'tmpl-ptr', code: 'PTR-BATCH', name: "PTR renewal for the firm's lawyers", kind: 'lgu', frequency: 'annual', officeAction: true, office: 'lgu', action: 'submit', payment: true, lines: [["List of practicing lawyers", 'client', 'digital'], ['Prior PTR numbers', 'client', 'digital']] },
  ];
  const templates: TaskTemplate[] = tmplDefs.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    kind: t.kind,
    frequency: t.frequency,
    appliesTo: {},
    officeAction: t.officeAction,
    defaultOfficeType: t.office,
    defaultAction: t.action,
    paymentExpected: t.payment,
    defaultDue: t.due,
    description: 'Sample template; unverified until the operator checks it against current BIR issuances.',
    verified: false,
    active: true,
    ...meta(D),
  }));
  const reqTemplates: RequirementTemplate[] = tmplDefs.flatMap((t) =>
    t.lines.map(([label, suppliedBy, copyForm, copies], i) => ({
      id: `req-${t.id.replace('tmpl-', '')}-${i + 1}`,
      taskTemplateId: t.id,
      label,
      required: true,
      copyForm,
      copies,
      suppliedBy,
      sortOrder: i + 1,
      verified: false,
      ...meta(D),
    }))
  );

  // ---------- Open work ----------
  const tasks: Task[] = [];
  const taskLines: TaskLine[] = [];
  const documents: DocumentFile[] = [];
  const activity: ActivityEvent[] = [];
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${String(++seq).padStart(3, '0')}`;

  const clientCode: Record<string, string> = {
    'client-rsp': 'RSP', 'client-cruz': 'CSL', 'client-maria': 'MEL', 'client-horizon': 'HLC',
    'client-vtl': 'VTL', 'client-bol': 'BOL', 'client-amd': 'AMD', 'client-jra': 'JRA',
  };
  const clientName: Record<string, string> = {
    'client-rsp': 'RSP Law Offices', 'client-cruz': 'Cruz & Santos Litigation', 'client-maria': 'Atty. Maria Elena Lopez',
    'client-horizon': 'Horizon Legal Consultancy Inc.', 'client-vtl': 'Villanueva Tan Law', 'client-bol': 'Bautista Ocampo Legal',
    'client-amd': 'Atty. Andrea Mendoza', 'client-jra': 'Atty. Jose Ramos',
  };

  const svgDoc = (name: string) =>
    `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><rect width="600" height="800" fill="#ffffff"/><text x="40" y="80" font-family="sans-serif" font-size="16" fill="#111827">${name.replace(/&/g, '&amp;')}</text><text x="40" y="110" font-family="sans-serif" font-size="12" fill="#6b7280">Sample placeholder file</text></svg>`
    )}`;
  const hex = (n: number) => n.toString(16).padStart(8, '0').repeat(8);

  function addDocument(opts: {
    clientId: ID; taskId?: ID; lineId?: ID; kind: DocumentKind; displayName: string; date: ISODate;
    by?: ID; versionNo?: number; replacesId?: ID; id?: ID; paymentId?: ID;
  }): DocumentFile {
    const id = opts.id ?? nextId('doc-demo');
    const doc: DocumentFile = {
      id,
      clientId: opts.clientId,
      taskId: opts.taskId,
      lineId: opts.lineId,
      paymentId: opts.paymentId,
      kind: opts.kind,
      displayName: opts.displayName,
      originalName: opts.displayName.replace(/_v\d+/, ''),
      mimeType: 'image/svg+xml',
      sizeBytes: 90 * 1024,
      originalSizeBytes: 240 * 1024,
      compressed: true,
      sha256: hex(Math.floor(rand() * 0xffffffff)),
      storageKey: svgDoc(opts.displayName),
      versionNo: opts.versionNo ?? 1,
      replacesId: opts.replacesId,
      source: 'upload',
      ...meta(opts.date, opts.by ?? ANA),
    };
    documents.push(doc);
    activity.push({
      id: nextId('act-demo'),
      orgId,
      at: at(opts.date, '11:00:00'),
      actorId: opts.by ?? ANA,
      entity: 'document',
      entityId: id,
      clientId: opts.clientId,
      action: 'file_uploaded',
      summary: `${opts.by === BEN ? 'Ben Morales' : 'Ana Santos'} uploaded ${opts.displayName}`,
    });
    return doc;
  }

  type LineDef = { label: string; status: LineStatus; supplier?: Supplier; form?: CopyForm; copies?: number; opts?: Partial<TaskLine>; doc?: boolean; by?: ID };
  const L = (label: string, status: LineStatus, extra: Partial<LineDef> = {}): LineDef => ({ label, status, ...extra });

  interface TaskDef {
    id: ID; clientId: ID; templateId?: ID; code: string; title: string; kind: TaskKind; period?: string;
    due: number; stored: TaskStatus; officeAction?: boolean; payment?: boolean; owner?: ID;
    lines: LineDef[]; extra?: Partial<Task>; nextAction?: Task['nextAction'];
  }

  function addTask(def: TaskDef): Task {
    const created = rel(-20 + Math.floor(rand() * 10));
    const task: Task = {
      id: def.id,
      clientId: def.clientId,
      templateId: def.templateId,
      title: def.title,
      kind: def.kind,
      period: def.period,
      dueDate: rel(def.due),
      dueSource: { kind: 'template' },
      ownerUserId: def.owner ?? ANA,
      officeAction: def.officeAction ?? false,
      paymentExpected: def.payment ?? false,
      status: def.stored,
      nextAction: def.nextAction,
      tags: [],
      ...meta(created),
      updatedAt: at(D),
      ...def.extra,
    };
    tasks.push(task);
    activity.push({
      id: nextId('act-demo'),
      orgId,
      at: at(created, '08:45:00'),
      actorId: ANA,
      entity: 'task',
      entityId: task.id,
      clientId: task.clientId,
      action: 'created',
      summary: `Ana Santos created ${def.title} for ${clientName[def.clientId]}`,
    });
    def.lines.forEach((l, i) => {
      const lineId = `${def.id.replace('task-', 'line-')}-${i + 1}`;
      const requested = l.status !== 'not_requested' && l.status !== 'not_applicable';
      const received = ['received', 'under_review', 'accepted', 'incomplete', 'needs_correction'].includes(l.status);
      const reviewed = ['accepted', 'incomplete', 'needs_correction'].includes(l.status);
      const line: TaskLine = {
        id: lineId,
        taskId: task.id,
        clientId: task.clientId,
        label: l.label,
        required: true,
        copyForm: l.form ?? 'digital',
        copies: l.copies,
        suppliedBy: l.supplier ?? 'client',
        printAndBring: (l.form ?? 'digital') !== 'digital',
        status: l.status,
        sortOrder: i + 1,
        requestedAt: requested ? at(rel(-14)) : undefined,
        receivedAt: received ? at(rel(-8), '14:00:00') : undefined,
        receivedVia: received ? 'viber' : undefined,
        reviewedBy: reviewed ? ANA : undefined,
        reviewedAt: reviewed ? at(rel(-6), '10:00:00') : undefined,
        naReason: l.status === 'not_applicable' ? 'Not applicable this period (no such transactions)' : undefined,
        flagNote: l.status === 'incomplete' ? 'Pages 3–4 are missing' : l.status === 'needs_correction' ? 'TIN digits do not match the registration' : undefined,
        lateDiscovered: false,
        documentIds: [],
        ...meta(created),
        ...l.opts,
      };
      // Files exist only for lines that still need a look (received, under review, flagged); accepted lines keep the demo to about 30 files
      if (['received', 'under_review', 'incomplete', 'needs_correction'].includes(l.status) || l.doc) {
        const doc = addDocument({
          clientId: task.clientId,
          taskId: task.id,
          lineId,
          kind: 'source',
          displayName: `${clientCode[task.clientId]}_${def.code.replace(/\s+/g, '')}_${def.period ?? 'adhoc'}_${l.label.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 24)}_v1.pdf`,
          date: rel(-8),
          by: l.by ?? ANA,
        });
        line.documentIds = [doc.id];
      }
      taskLines.push(line);
    });
    return task;
  }

  const ack = (clientId: ID, taskId: ID, name: string, date: ISODate, kind: DocumentKind = 'acknowledgment') =>
    addDocument({ clientId, taskId, kind, displayName: name, date });

  // Overdue: D-2 (VTL 2551-Q), D-5 (BOL 2550-Q). Due within 7 days: RSP 1601-EQ, HLC 1601-C, MEL 1601-C.
  addTask({ id: 'task-vtl-2551q', clientId: 'client-vtl', templateId: 'tmpl-2551q', code: '2551Q', title: 'BIR 2551-Q — Q3 2026', kind: 'filing', period: '2026-Q3', due: -2, stored: 'in_preparation', payment: true,
    lines: [L('Sales summary', 'requested')], nextAction: { text: 'Chase Liza for the Q3 sales summary', owner: 'operator', due: D } });
  addTask({ id: 'task-bol-2550q', clientId: 'client-bol', templateId: 'tmpl-2550q', code: '2550Q', title: 'BIR 2550-Q — Q3 2026', kind: 'filing', period: '2026-Q3', due: -5, stored: 'in_preparation', payment: true,
    lines: [L('Sales list', 'not_requested'), L('Purchase list', 'not_requested'), L('Input VAT invoices', 'not_requested', { form: 'photocopy', copies: 1 })],
    nextAction: { text: 'Send the first document request', owner: 'operator', due: D } });
  addTask({ id: 'task-rsp-1601eq', clientId: 'client-rsp', templateId: 'tmpl-1601eq', code: '1601EQ', title: 'BIR 1601-EQ — Q3 2026', kind: 'filing', period: '2026-Q3', due: 3, stored: 'ready_next_step', payment: true, officeAction: true,
    lines: [L('Quarterly payee data', 'accepted'), L('Monthly confirmations', 'accepted', { supplier: 'operator' })],
    nextAction: { text: 'Submit at RDO (trip V1)', owner: 'operator', due: rel(2) },
    extra: { readyAt: at(rel(-3)) } });
  addTask({ id: 'task-hlc-1601c', clientId: 'client-horizon', templateId: 'tmpl-1601c', code: '1601C', title: 'BIR 1601-C — September 2026', kind: 'filing', period: '2026-09', due: 4, stored: 'submitted', payment: true,
    lines: [L('Payroll register', 'accepted'), L('Hires and separations', 'accepted')],
    extra: { submittedAt: at(rel(-1)), submittedVia: 'efps', submissionRef: 'EFPS-DEMO-0001' } });
  addTask({ id: 'task-maria-1601c', clientId: 'client-maria', templateId: 'tmpl-1601c', code: '1601C', title: 'BIR 1601-C — September 2026', kind: 'filing', period: '2026-09', due: 6, stored: 'in_preparation', payment: true,
    lines: [L('Payroll register', 'requested'), L('Hires and separations', 'requested')],
    extra: { statusOverride: { status: 'ready_next_step', reason: 'Payroll unchanged — confirmed by phone', by: ANA, at: at(rel(-2)) } } });
  addTask({ id: 'task-cruz-2307', clientId: 'client-cruz', templateId: 'tmpl-2307col', code: '2307COL', title: '2307-COL — Q3 2026', kind: 'other', period: '2026-Q3', due: 12, stored: 'in_preparation',
    owner: BEN,
    lines: [L("2307s from the firm's payors", 'needs_correction', { form: 'original', opts: { lateDiscovered: true } }), L('Supplementary 2307 batch', 'incomplete', { form: 'photocopy' })],
    nextAction: { text: 'Ask the client to resend corrected 2307s', owner: 'client', due: rel(3) } });
  addTask({ id: 'task-cruz-2550q', clientId: 'client-cruz', templateId: 'tmpl-2550q', code: '2550Q', title: 'BIR 2550-Q — Q3 2026', kind: 'filing', period: '2026-Q3', due: 18, stored: 'in_preparation', payment: true, owner: BEN,
    lines: [L('Sales list', 'received', { by: BEN }), L('Purchase list', 'requested'), L('Input VAT invoices', 'requested', { form: 'photocopy', copies: 1 })] });
  addTask({ id: 'task-rsp-2307', clientId: 'client-rsp', templateId: 'tmpl-2307col', code: '2307COL', title: '2307-COL — Q3 2026', kind: 'other', period: '2026-Q3', due: 20, stored: 'in_preparation',
    lines: [L("2307s from the firm's payors", 'received', { form: 'original', by: BEN })] });
  addTask({ id: 'task-hlc-2550q', clientId: 'client-horizon', templateId: 'tmpl-2550q', code: '2550Q', title: 'BIR 2550-Q — Q3 2026', kind: 'filing', period: '2026-Q3', due: 15, stored: 'in_preparation', payment: true,
    lines: [L('Sales list', 'under_review'), L('Purchase list', 'accepted'), L('Input VAT invoices', 'not_applicable', { form: 'photocopy', copies: 1 })] });
  addTask({ id: 'task-hlc-0619e', clientId: 'client-horizon', templateId: 'tmpl-0619e', code: '0619E', title: 'BIR 0619-E — September 2026', kind: 'filing', period: '2026-09', due: 1, stored: 'awaiting_follow_up', payment: true,
    lines: [L('Payee list with amounts', 'accepted'), L('Payment records', 'accepted', { form: 'photocopy' })],
    nextAction: { text: 'Confirm BIR acknowledgment with Horizon', owner: 'operator', due: rel(1) },
    extra: { submittedAt: at(rel(-2)), submittedVia: 'efps' } });
  addTask({ id: 'task-rsp-1601c', clientId: 'client-rsp', templateId: 'tmpl-1601c', code: '1601C', title: 'BIR 1601-C — September 2026', kind: 'filing', period: '2026-09', due: 9, stored: 'ready_for_review', payment: true,
    lines: [L('Payroll register', 'accepted'), L('Hires and separations', 'accepted')] });
  addTask({ id: 'task-rsp-0619e-oct', clientId: 'client-rsp', templateId: 'tmpl-0619e', code: '0619E', title: 'BIR 0619-E — October 2026', kind: 'filing', period: '2026-10', due: 14, stored: 'in_preparation', payment: true,
    lines: [L('Payee list with amounts', 'not_requested'), L('Payment records', 'not_requested', { form: 'photocopy' })] });
  addTask({ id: 'task-bol-ecar', clientId: 'client-bol', templateId: 'tmpl-ecar', code: 'ECAR', title: 'eCAR — sale of real property (Lot 14)', kind: 'one_time_transaction', due: 10, stored: 'in_preparation', officeAction: true, payment: true,
    lines: [
      L('Deed of sale', 'accepted', { form: 'certified_true_copy', copies: 2, doc: true }), L('Title', 'received', { form: 'certified_true_copy' }),
      L('Tax declaration', 'accepted', { form: 'certified_true_copy', doc: true }), L('IDs of parties', 'accepted', { form: 'photocopy', copies: 2, doc: true }),
      L('Authority to transact', 'accepted', { supplier: 'operator', form: 'original', doc: true }), L('Tax payment proof', 'accepted', { supplier: 'operator', form: 'original', doc: true }),
    ], nextAction: { text: 'Review the title copy', owner: 'operator', due: D } });
  addTask({ id: 'task-vtl-reg', clientId: 'client-vtl', code: 'REG', title: 'Registration update (1905) — VTL', kind: 'registration', due: 8, stored: 'in_preparation', officeAction: true,
    lines: [L('Signed 1905', 'accepted'), L('Updated Mayor’s permit', 'accepted', { form: 'photocopy', copies: 1 })],
    nextAction: { text: 'Get a new SPA signed before the trip', owner: 'client', due: rel(1) } });
  addTask({ id: 'task-vtl-ptr', clientId: 'client-vtl', templateId: 'tmpl-ptr', code: 'PTR', title: 'PTR renewal — VTL lawyers', kind: 'lgu', due: 25, stored: 'in_preparation', officeAction: true, payment: true,
    lines: [L('List of practicing lawyers', 'requested'), L('Prior PTR numbers', 'requested')] });
  addTask({ id: 'task-bol-1702ex', clientId: 'client-bol', templateId: 'tmpl-1702ex', code: '1702EX', title: 'BIR 1702-EX — 2026 annual', kind: 'filing', period: '2026', due: 150, stored: 'in_preparation',
    extra: { dueSource: { kind: 'manual' } },
    lines: [L('Audited statements', 'requested', { supplier: 'third_party' }), L("Partners' share schedule", 'not_requested')] });
  addTask({ id: 'task-amd-2550q', clientId: 'client-amd', templateId: 'tmpl-2550q', code: '2550Q', title: 'BIR 2550-Q — Q3 2026 (VAT status unknown)', kind: 'filing', period: '2026-Q3', due: 22, stored: 'in_preparation', payment: true,
    lines: [L('Confirm VAT registration (BIR 2303)', 'not_requested'), L('Sales list', 'not_requested')],
    nextAction: { text: 'Ask for the BIR 2303 to confirm VAT status', owner: 'client', due: rel(2) } });
  addTask({ id: 'task-cruz-1601c-oct', clientId: 'client-cruz', templateId: 'tmpl-1601c', code: '1601C', title: 'BIR 1601-C — October 2026', kind: 'filing', period: '2026-10', due: 14, stored: 'in_preparation', payment: true, owner: BEN,
    lines: [L('Payroll register', 'not_requested'), L('Hires and separations', 'not_requested')] });
  addTask({ id: 'task-bol-0619e', clientId: 'client-bol', templateId: 'tmpl-0619e', code: '0619E', title: 'BIR 0619-E — September 2026', kind: 'filing', period: '2026-09', due: 5, stored: 'in_preparation', payment: true,
    lines: [L('Payee list with amounts', 'requested'), L('Payment records', 'requested', { form: 'photocopy' })] });
  addTask({ id: 'task-bol-1601c', clientId: 'client-bol', templateId: 'tmpl-1601c', code: '1601C', title: 'BIR 1601-C — September 2026', kind: 'filing', period: '2026-09', due: 7, stored: 'in_preparation', payment: true,
    lines: [L('Payroll register', 'received'), L('Hires and separations', 'accepted')] });
  addTask({ id: 'task-hlc-0619e-oct', clientId: 'client-horizon', templateId: 'tmpl-0619e', code: '0619E', title: 'BIR 0619-E — October 2026', kind: 'filing', period: '2026-10', due: 14, stored: 'in_preparation', payment: true,
    lines: [L('Payee list with amounts', 'not_requested'), L('Payment records', 'not_requested', { form: 'photocopy' })] });
  addTask({ id: 'task-vtl-1601c', clientId: 'client-vtl', templateId: 'tmpl-1601c', code: '1601C', title: 'BIR 1601-C — September 2026', kind: 'filing', period: '2026-09', due: 6, stored: 'in_preparation', payment: true,
    lines: [L('Payroll register', 'requested'), L('Hires and separations', 'accepted')] });
  addTask({ id: 'task-cruz-0619e', clientId: 'client-cruz', templateId: 'tmpl-0619e', code: '0619E', title: 'BIR 0619-E — September 2026', kind: 'filing', period: '2026-09', due: 8, stored: 'ready_for_review', payment: true, owner: BEN,
    lines: [L('Payee list with amounts', 'accepted'), L('Payment records', 'accepted', { form: 'photocopy' })] });
  addTask({ id: 'task-maria-1601c-aug', clientId: 'client-maria', templateId: 'tmpl-1601c', code: '1601C', title: 'BIR 1601-C — August 2026', kind: 'filing', period: '2026-08', due: -22, stored: 'completed', payment: true,
    lines: [L('Payroll register', 'accepted'), L('Hires and separations', 'accepted')],
    extra: { completedAt: at(rel(-24)), submittedAt: at(rel(-25)), submittedVia: 'ebirforms', readyAt: at(rel(-27)) } });
  addTask({ id: 'task-hlc-2550q-q2', clientId: 'client-horizon', templateId: 'tmpl-2550q', code: '2550Q', title: 'BIR 2550-Q — Q2 2026', kind: 'filing', period: '2026-Q2', due: -90, stored: 'completed', payment: true,
    lines: [L('Sales list', 'accepted'), L('Purchase list', 'accepted')],
    extra: { completedAt: at(rel(-95)), submittedAt: at(rel(-96)), submittedVia: 'efps', readyAt: at(rel(-100)) } });
  addTask({ id: 'task-jra-close', clientId: 'client-jra', code: 'CLOSE', title: 'Close books and file final return — JRA', kind: 'other', due: -100, stored: 'archived', owner: ANA,
    lines: [L('Final ledger', 'accepted')], extra: { archivedReason: 'Client closed his practice; history only' } });

  // Evidence for the completed tasks
  ack('client-horizon', 'task-hlc-2550q-q2', 'HLC_2550Q_2026-Q2_ack_v1.pdf', rel(-95));
  ack('client-maria', 'task-maria-1601c-aug', 'MEL_1601C_2026-08_return_v1.pdf', rel(-25), 'filed_return');
  const ackV1 = ack('client-rsp', 'task-rsp-1601eq', 'RSP_1601EQ_2026Q3_workpaper_v1.pdf', rel(-4), 'other');
  addDocument({ clientId: 'client-rsp', taskId: 'task-rsp-1601eq', kind: 'other', displayName: 'RSP_1601EQ_2026Q3_workpaper_v2.pdf', date: rel(-3), versionNo: 2, replacesId: ackV1.id });
  addDocument({ clientId: 'client-vtl', kind: 'authorization', displayName: 'VTL_SPA_expired_v1.pdf', date: rel(-370) });
  addDocument({ clientId: 'client-bol', kind: 'authorization', displayName: 'BOL_SPA_v1.pdf', date: rel(-90) });

  // ---------- Current visits (spec 18.5) ----------
  const v1Date = nextWorkingDay(nextWorkingDay(D));
  const v2Date = nextWorkingDay(D);
  const v3Date = workingOnOrBefore(rel(-7));

  const visits: Visit[] = [];
  const visitItems: VisitItem[] = [];
  const mkItem = (id: ID, visitId: ID, taskId: ID, clientId: ID, action: VisitAction, date: ISODate, extra: Partial<VisitItem> = {}) => {
    visitItems.push({
      id, visitId, taskId, clientId, intendedAction: action, isFirstVisitForTask: true, evidenceDocumentIds: [],
      ...meta(date), ...extra,
    });
  };

  visits.push({
    id: 'visit-v1', officeId: 'off-rdo39', officeType: 'rdo', officeName: 'BIR RDO 39 - South Quezon City', rdoCode: '039',
    plannedDate: v1Date, arriveBy: '09:00', assigneeUserId: ANA,
    purpose: 'eCAR, registration update and 1601-EQ submission', status: 'planned', packedLineIds: [], packedKitItemIds: [],
    ...meta(D),
  });
  mkItem('vitem-v1-1', 'visit-v1', 'task-bol-ecar', 'client-bol', 'submit', D, { questions: 'Is the certified title copy acceptable?' });
  mkItem('vitem-v1-2', 'visit-v1', 'task-vtl-reg', 'client-vtl', 'submit', D);
  mkItem('vitem-v1-3', 'visit-v1', 'task-rsp-1601eq', 'client-rsp', 'submit', D);

  visits.push({
    id: 'visit-v2', officeId: 'off-lbp', officeType: 'bank', officeName: 'Land Bank of the Philippines - QC Circle Branch',
    plannedDate: v2Date, arriveBy: '09:30', assigneeUserId: BEN, purpose: 'Pay Horizon 1601-C remittance', status: 'planned',
    packedLineIds: [], packedKitItemIds: [], ...meta(D),
  });
  mkItem('vitem-v2-1', 'visit-v2', 'task-hlc-1601c', 'client-horizon', 'pay', D);

  visits.push({
    id: 'visit-v3', officeId: 'off-rdo39', officeType: 'rdo', officeName: 'BIR RDO 39 - South Quezon City', rdoCode: '039',
    plannedDate: v3Date, arriveBy: '09:00', assigneeUserId: ANA, purpose: 'Submit and request certified copies', status: 'done',
    packedLineIds: [], packedKitItemIds: [], startedAt: at(v3Date, '08:40:00'), finishedAt: at(v3Date, '11:50:00'),
    costs: { transport: 22000, parking: 8000, note: 'Grab and meter parking' }, ...meta(addDaysToDate(v3Date, -2)),
  });
  mkItem('vitem-v3-1', 'visit-v3', 'task-maria-1601c-aug', 'client-maria', 'submit', v3Date, {
    outcome: 'completed', evidenceDocumentIds: [documents.find((d) => d.taskId === 'task-maria-1601c-aug')!.id],
    outcomeAt: at(v3Date, '10:30:00'), recordedBy: ANA, windowOrOfficer: 'Window 4',
  });
  mkItem('vitem-v3-2', 'visit-v3', 'task-hlc-2550q-q2', 'client-horizon', 'submit', v3Date, {
    outcome: 'more_documents_requested', outcomeCause: 'missing_document', avoidable: true,
    outcomeNote: 'Officer asked for the SLSP files', nextAction: { text: 'Collect the SLSP files from Horizon', owner: 'client', due: addDaysToDate(v3Date, 3) },
    outcomeAt: at(v3Date, '11:15:00'), recordedBy: ANA, followUpId: 'fu-demo-slsp', isFirstVisitForTask: true,
  });

  // ---------- Follow-ups (current: seven in total with the four in the base seed) ----------
  const followUps: FollowUp[] = [];
  const followUpAttempts: FollowUpAttempt[] = [];
  const msgEn = (c: string, t: string) => `Hi ${c}, good day. Following up on ${t}. Could you send these by ${rel(2)}? Thank you.`;
  const msgFil = (c: string, t: string) => `Magandang araw po, ${c}. Follow-up lang po para sa ${t}. Maaari po bang maipadala bago ang ${rel(2)}? Salamat po.`;
  function addFollowUp(id: ID, clientId: ID, taskId: ID, status: FollowUp['status'], lang: 'en' | 'fil', expectedBy: ISODate, attempts: number, extra: Partial<FollowUp> = {}) {
    followUps.push({
      id, clientId, taskId, lineIds: [], channel: lang === 'fil' ? 'viber' : 'email', language: lang, expectedBy, attemptCount: attempts, status,
      ...meta(rel(-8), BEN), ...extra,
    });
    for (let n = 1; n <= attempts; n++) {
      followUpAttempts.push({
        id: `${id}-a${n}`, followUpId: id, attemptNo: n, channel: lang === 'fil' ? 'viber' : 'email',
        sentAt: at(rel(-9 + n * 2), '10:00:00'), sentBy: n % 2 ? ANA : BEN,
        messageSnapshot: lang === 'fil' ? msgFil(clientName[clientId], 'mga dokumento') : msgEn(clientName[clientId], 'the pending documents'),
        expectedBy, ...meta(rel(-9 + n * 2), ANA),
      });
    }
  }
  addFollowUp('fu-demo-vtl-sales', 'client-vtl', 'task-vtl-2551q', 'escalated', 'fil', rel(-3), 3, { escalatedReason: 'Three requests with no reply; call the partner directly' });
  addFollowUp('fu-demo-bol-title', 'client-bol', 'task-bol-ecar', 'sent', 'en', rel(2), 2);
  addFollowUp('fu-demo-slsp', 'client-horizon', 'task-hlc-2550q-q2', 'open', 'en', D, 0);

  // ---------- Payments (eight in the last 60 days in total with the base seed's one) ----------
  const payments: Payment[] = [];
  const payDefs: Array<[ID, ID, number, number, PaymentChannel, 'client' | 'operator', boolean, string]> = [
    ['client-horizon', 'task-hlc-0619e', -3, 1245000, 'aab_otc', 'client', true, 'LBP-OTC-71120'],
    ['client-maria', 'task-maria-1601c-aug', -25, 380000, 'online', 'client', true, 'GCASH-5521'],
    ['client-horizon', 'task-hlc-2550q-q2', -52, 3180000, 'aab_otc', 'client', true, 'LBP-OTC-60412'],
    ['client-vtl', 'task-vtl-2551q', -14, 215000, 'rco', 'client', false, 'RCO-0099'], // proof missing
    ['client-rsp', 'task-rsp-1601c', -10, 1830000, 'aab_otc', 'operator', true, 'LBP-OTC-70002'],
    ['client-cruz', 'task-cruz-2550q', -30, 760000, 'online', 'client', true, 'BANKO-8841'],
    ['client-bol', 'task-bol-ecar', -18, 4500000, 'aab_otc', 'client', true, 'LBP-OTC-69331'],
  ];
  payDefs.forEach(([clientId, taskId, dayOff, amount, channel, paidBy, withProof, ref], i) => {
    const id = `pay-demo-${i + 1}`;
    const paidOn = rel(dayOff);
    const proof = withProof
      ? [addDocument({ clientId, taskId, kind: 'payment_proof', displayName: `${clientCode[clientId]}_payment_${ref}_v1.pdf`, date: paidOn, paymentId: id }).id]
      : [];
    payments.push({
      id, clientId, taskId, amount, paidOn, channel, provider: channel === 'online' ? 'Online banking' : 'Land Bank of the Philippines',
      referenceNo: ref, paidBy, reimbursement: paidBy === 'operator' ? { status: 'reimbursed', reimbursedOn: addDaysToDate(paidOn, 4) } : undefined,
      proofDocumentIds: proof, note: withProof ? undefined : 'Proof missing — ask the client for the deposit slip', ...meta(paidOn),
    });
  });

  // ---------- Notifications (twelve in total with the base seed's five unread) ----------
  const notifications: Notification[] = [];
  const notifDefs: Array<[NotificationType, string, string, string, number]> = [
    ['overdue', 'Overdue: BIR 2551-Q (VTL)', 'Due 2 days ago and the sales summary is still missing.', '/tasks/task-vtl-2551q', -1],
    ['overdue', 'Overdue: BIR 2550-Q (BOL)', 'Due 5 days ago; no document request sent yet.', '/tasks/task-bol-2550q', -2],
    ['follow_ups_due', 'Follow-ups due today', 'One follow-up is due today and one is escalated.', '/follow-ups', -3],
    ['authorization_expiring', 'Authorization expiring soon', 'The authorization letter for Atty. Maria Elena Lopez expires in 12 days.', '/clients/client-maria', -4],
    ['visit_ready', 'Visit ready', 'The Land Bank trip is ready to go.', '/visits/visit-v2', -5],
    ['outcome_recorded', 'Outcome recorded', 'Counter result saved for the RDO 39 trip.', '/visits/visit-v3', -6],
    ['monthly_check_in', 'Monthly check-in', 'Two questions for the Insights pulse.', '/insights', -7],
  ];
  notifDefs.forEach(([type, title, body, link, dayOff], i) => {
    const date = rel(dayOff);
    notifications.push({
      id: `notif-demo-${i + 1}`, userId: ANA, type, title, body, link, readAt: at(date, '18:00:00'), ...meta(date),
    });
  });

  // ---------- Notes (six) ----------
  const noteDefs: Array<['client' | 'task' | 'visit', ID, string, boolean]> = [
    ['client', 'client-vtl', 'Prefers Viber in Filipino. Partner answers after 5 PM.', true],
    ['client', 'client-cruz', 'Slowest to send documents; start requests 10 days before the deadline.', true],
    ['task', 'task-bol-ecar', 'Title copy came as a plain photocopy; asked for a certified true copy.', false],
    ['task', 'task-maria-1601c', 'Payroll unchanged per phone call on the 20th.', false],
    ['visit', 'visit-v1', 'Window 5 for ONETT. Arrive before 9 for a queue number.', true],
    ['client', 'client-amd', 'Imported from the sample list; still missing TIN and 2303.', false],
  ];
  const notes: Note[] = noteDefs.map(([entity, entityId, body, pinned], i) => ({
    id: `note-demo-${i + 1}`, entity, entityId, body, pinned, ...meta(rel(-10 + i)),
  }));

  // ---------- Six months of history (spec 18.6) ----------
  const hist = {
    visits: [9, 8, 7, 6, 6, 5],
    ipv: [1.4, 1.6, 1.9, 2.2, 2.4, 2.6],
    returns: [6, 5, 4, 3, 2, 2],
    avoidable: [5, 4, 3, 2, 2, 1],
    fuMedian: [3, 3, 2.5, 2, 2, 1.5],
    onTime: [0.78, 0.82, 0.86, 0.9, 0.92, 0.94],
    ready: [0.4, 0.55, 0.7, 0.8, 0.85, 0.92],
  };
  const failOutcomes: Outcome[] = ['more_documents_requested', 'correction_required', 'not_accepted', 'follow_up_required'];
  const avoidableCauses: OutcomeCause[] = ['missing_document', 'wrong_copy_form', 'document_error', 'unsigned_or_unnotarized', 'wrong_copy_count'];
  const unavoidableCauses: OutcomeCause[] = ['office_system_down', 'new_requirement', 'processing_time', 'officer_unavailable'];
  const histClients: ID[] = ['client-rsp', 'client-cruz', 'client-horizon', 'client-bol', 'client-vtl', 'client-maria'];
  const histTemplates: Array<[string, string, TaskKind]> = [['tmpl-0619e', '0619E', 'filing'], ['tmpl-1601c', '1601C', 'filing'], ['tmpl-2550q', '2550Q', 'filing']];

  for (let k = 6; k >= 1; k--) {
    const mi = 6 - k; // 0..5
    const { year, month } = shiftMonth(D, -k);
    const dim = daysInMonth(year, month);
    const N = hist.visits[mi];
    const totalItems = Math.round(N * hist.ipv[mi]);
    const per = Math.floor(totalItems / N);
    const extra = totalItems % N;
    const R = hist.returns[mi];
    const A = hist.avoidable[mi];

    for (let j = 0; j < N; j++) {
      const target = `${year}-${pad(month)}-${pad(Math.min(dim, 3 + Math.floor((j * 24) / N)))}`;
      let date = workingOnOrAfter(target);
      if (!date.startsWith(`${year}-${pad(month)}`)) date = workingOnOrBefore(target);
      const visitId = `visit-h${k}-${j + 1}`;
      const leftReady = rand() < hist.ready[mi];
      const itemCount = per + (j < extra ? 1 : 0);
      const byBen = j % 3 === 2;
      const cost = 15000 + Math.floor(rand() * 30000);
      const hours = 1.5 + rand() * 2.5;
      const startH = 8 + Math.floor(rand() * 2);
      const start = at(date, `${pad(startH)}:${pad(Math.floor(rand() * 60))}:00`);
      const finishMin = Math.round(hours * 60);
      const finish = at(date, `${pad(Math.min(23, startH + Math.floor(finishMin / 60)))}:${pad(finishMin % 60)}:00`);
      visits.push({
        id: visitId, officeId: 'off-rdo39', officeType: 'rdo', officeName: 'BIR RDO 39 - South Quezon City', rdoCode: '039',
        plannedDate: date, arriveBy: '09:00', assigneeUserId: byBen ? BEN : ANA, purpose: 'Filing and counter transactions', status: 'done',
        packedLineIds: [], packedKitItemIds: [], startedAt: start, finishedAt: finish,
        departureOverrideReason: leftReady ? undefined : 'Left with one item not ready; client promised the file at the counter',
        costs: { transport: cost, parking: 0 }, ...meta(addDaysToDate(date, -3)),
      });
      activity.push({
        id: nextId('act-demo'), orgId, at: finish, actorId: byBen ? BEN : ANA, entity: 'visit', entityId: visitId,
        action: 'visit_finished', summary: `${byBen ? 'Ben Morales' : 'Ana Santos'} finished the trip to RDO 39`,
      });

      for (let n = 0; n < itemCount; n++) {
        const clientId = histClients[(j * 2 + n + mi) % histClients.length];
        const [tmplId, code, kind] = histTemplates[(j + n + mi) % histTemplates.length];
        const tId = `task-h${k}-${j + 1}-${n + 1}`;
        const onTime = rand() < hist.onTime[mi];
        const due = onTime ? addDaysToDate(date, 2) : addDaysToDate(date, -2);
        const failing = j < R && n === 0;
        const slow = clientId === 'client-cruz';
        const reqDay = addDaysToDate(date, -(slow ? 12 : 7));
        const recDay = addDaysToDate(reqDay, slow ? 6 : 2 + Math.floor(rand() * 2));
        const finishDate = failing ? addDaysToDate(date, 4) : date;
        tasks.push({
          id: tId, clientId, templateId: tmplId, title: `${code} — history`, kind, period: `${year}-${pad(month)}`, dueDate: due,
          dueSource: { kind: 'template' }, ownerUserId: byBen ? BEN : ANA, officeAction: true, paymentExpected: true,
          status: 'completed', completedAt: at(failing ? addDaysToDate(date, 4) : date, '15:00:00'),
          submittedAt: at(finishDate, '12:00:00'), submittedVia: 'office', readyAt: at(recDay, '16:00:00'), tags: [], ...meta(addDaysToDate(date, -14)),
        });
        taskLines.push({
          id: `line-${tId}-1`, taskId: tId, clientId, label: 'Supporting documents', required: true, copyForm: 'photocopy', copies: 1,
          suppliedBy: 'client', printAndBring: true, status: 'accepted', sortOrder: 1, requestedAt: at(reqDay), receivedAt: at(recDay, '14:00:00'),
          receivedVia: 'viber', reviewedBy: ANA, reviewedAt: at(recDay, '16:00:00'), lateDiscovered: false, documentIds: [], ...meta(addDaysToDate(date, -14)),
        });
        const failIdx = (j + n) % failOutcomes.length;
        const isAvoidable = failing && j < A;
        visitItems.push({
          id: `vitem-${visitId}-${n + 1}`, visitId, taskId: tId, clientId, intendedAction: 'submit',
          readyAtDeparture: leftReady, isFirstVisitForTask: true,
          outcome: failing ? failOutcomes[failIdx] : (n % 2 ? 'submitted_pending' : 'completed'),
          outcomeCause: failing ? (isAvoidable ? avoidableCauses[j % avoidableCauses.length] : unavoidableCauses[j % unavoidableCauses.length]) : undefined,
          avoidable: failing ? isAvoidable : undefined,
          evidenceDocumentIds: [], outcomeAt: finish, recordedBy: byBen ? BEN : ANA, ...meta(date),
        });

        // Follow-ups per task: attempts follow the month's median
        const med = hist.fuMedian[mi];
        const attempts = Math.max(1, Math.round(med + (rand() < 0.5 ? -0.5 : 0.5) * (n % 2 ? 1 : 0)));
        const fuId = `fu-h${k}-${j + 1}-${n + 1}`;
        followUps.push({
          id: fuId, clientId, taskId: tId, lineIds: [], channel: 'viber', language: clientId === 'client-vtl' ? 'fil' : 'en',
          expectedBy: recDay, attemptCount: attempts, status: 'resolved', resolvedAt: at(recDay, '16:00:00'), resolvedReason: 'Documents received',
          ...meta(reqDay, byBen ? BEN : ANA),
        });
        for (let a = 1; a <= attempts; a++) {
          const sentDay = addDaysToDate(reqDay, Math.min(a - 1, Math.max(0, (slow ? 6 : 2) - 1)));
          followUpAttempts.push({
            id: `${fuId}-a${a}`, followUpId: fuId, attemptNo: a, channel: 'viber', sentAt: at(sentDay, '10:00:00'), sentBy: byBen ? BEN : ANA,
            messageSnapshot: clientId === 'client-vtl' ? msgFil(clientName[clientId], `${code}`) : msgEn(clientName[clientId], `${code}`),
            expectedBy: recDay, ...meta(sentDay),
          });
        }
      }
    }

    // Payments for the month (one per two visits), ₱ amounts in centavos
    for (let p = 0; p < Math.ceil(N / 2); p++) {
      const taskId = `task-h${k}-${p * 2 + 1}-1`;
      const t = tasks.find((x) => x.id === taskId);
      if (!t) continue;
      // Keep "eight payments in the last 60 days" exact: history payments stop at 61 days back
      if (addDaysToDate(t.dueDate, -1) > rel(-61)) continue;
      payments.push({
        id: `pay-h${k}-${p + 1}`, clientId: t.clientId, taskId, amount: 150000 + Math.floor(rand() * 1800000), paidOn: addDaysToDate(t.dueDate, -1),
        channel: 'aab_otc', provider: 'Land Bank of the Philippines', referenceNo: `LBP-H${k}${p + 1}`, paidBy: 'client', proofDocumentIds: [], ...meta(addDaysToDate(t.dueDate, -1)),
      });
    }
  }

  // ---------- Baseline and pulses (spec 18.6) ----------
  const baseline: Baseline = {
    id: 'baseline-demo', periodStart: rel(-270), periodEnd: rel(-181),
    tripsPerMonth: 9, repeatTripsPerMonth: 4, followUpsPerWeek: 25, hoursFindingPerWeek: 5, lateFilingsPerQuarter: 1, confidence: 2,
    note: 'Sample baseline from before Ordinovix; the operator should replace it with her own numbers.', ...meta(rel(-181)),
  };
  const pulseHours = [5, 4.5, 4, 3, 2.5, 2];
  const pulseConfidence: Array<1 | 2 | 3 | 4 | 5> = [2, 2, 3, 3, 4, 4];
  const pulses: Pulse[] = pulseHours.map((hours, i) => {
    const { year, month } = shiftMonth(D, -(6 - i));
    return { id: `pulse-demo-${i + 1}`, month: `${year}-${pad(month)}`, hoursFindingLastWeek: hours, confidence: pulseConfidence[i], ...meta(`${year}-${pad(month)}-28`) };
  });

  // Fill the activity feed up to about 120 events with plausible review and send events for the current tasks
  const sorted = [...taskLines].filter((l) => l.status === 'accepted' && l.reviewedAt && !/^task-hd-/.test(l.taskId));
  for (const l of sorted) {
    activity.push({
      id: nextId('act-demo'), orgId, at: l.reviewedAt!, actorId: ANA, entity: 'line', entityId: l.id, clientId: l.clientId,
      action: 'status_changed', summary: `Ana Santos accepted ${l.label}`,
    });
  }
  followUpAttempts.filter((a) => !/^fu-hd-/.test(a.id)).forEach((a) => {
    const fu = followUps.find((f) => f.id === a.followUpId);
    activity.push({
      id: nextId('act-demo'), orgId, at: a.sentAt, actorId: a.sentBy, entity: 'follow_up', entityId: a.followUpId, clientId: fu?.clientId,
      action: 'follow_up_sent', summary: `${a.sentBy === BEN ? 'Ben Morales' : 'Ana Santos'} sent follow-up ${a.attemptNo}`,
    });
  });
  payments.forEach((p) => {
    activity.push({
      id: nextId('act-demo'), orgId, at: at(p.paidOn, '13:00:00'), actorId: ANA, entity: 'payment', entityId: p.id, clientId: p.clientId,
      action: 'created', summary: `Ana Santos recorded a payment (${p.referenceNo ?? 'no reference'})`,
    });
  });
  activity.sort((a, b) => a.at.localeCompare(b.at));

  return {
    offices, clients, contacts, authorizations, templates, reqTemplates, tasks, taskLines, visits, visitItems,
    followUps, followUpAttempts, payments, documents, notifications, notes, activity, baseline, pulses,
    holidays: newHolidays, deadlineMoves,
  };
}
