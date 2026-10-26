import type {
  User,
  Membership,
  Org,
  OrgSettings,
  UserPrefs,
  TodayQueue,
  Page,
  ClientSummary,
  Client,
  Contact,
  Authorization,
  TaskTemplate,
  RequirementTemplate,
  DeadlineMove,
  Holiday,
  TaskSummary,
  Task,
  TaskLine,
  DocumentFile,
  VisitSummary,
  VisitItem,
  Payment,
  FollowUpView,
  FollowUp,
  MessageTemplate,
  Office,
  OfficeStats,
  VisitDetail,
  Visit,
  VisitKitItem,
  Note,
  SavedView,
  Notification,
  CalendarItem,
  InsightsTab,
  InsightsFilter,
  InsightsData,
  Baseline,
  Pulse,
  ClientChecklistReport,
  ClientHistoryReport,
  MonthlySummaryReport,
  ActivityEvent,
  ActivityEntity,
  ActivityAction,
  SearchResults,
  ID,
  ISODate,
  ISODateTime,
  Centavos,
  PeriodKey,
  Role,
  EntityType,
  VatStatus,
  FilingChannel,
  EfpsGroup,
  TaskKind,
  TaskStatus,
  LineStatus,
  Channel,
  DocumentKind,
  FollowUpState,
  OfficeType,
  VisitStatus,
  VisitAction,
  Outcome,
  OutcomeCause,
  PaymentChannel,
  NextAction,
  OpenPeriodPreview,
  OpenPeriodPlan,
  ImportPreview,
} from '@/domain/types';

export interface Repositories {
  session: {
    me(): Promise<{ user: User; membership: Membership; org: Org; settings: OrgSettings; prefs: UserPrefs }>;
    signOut(): Promise<void>;
  };
  prefs: { save(p: Partial<UserPrefs>): Promise<UserPrefs> };
  settings: { save(s: Partial<OrgSettings>): Promise<OrgSettings> };
  memberships: {
    list(): Promise<Array<Membership & { name?: string; initials?: string; lastSignInAt?: string }>>;
    invite(m: { email: string; role: Role; clientIds: ID[]; name?: string; note?: string }): Promise<Membership & { name?: string; initials?: string }>;
    update(id: ID, m: Partial<Pick<Membership, 'role' | 'clientIds' | 'active'>> & { name?: string }): Promise<Membership & { name?: string; initials?: string }>;
    revoke(id: ID): Promise<void>;
  };

  today: { queue(scope?: 'mine' | 'everyone'): Promise<TodayQueue> };

  clients: {
    list(f?: {
      search?: string;
      status?: 'active' | 'archived';
      hasBlocked?: boolean;
      authAttention?: boolean;
      entityType?: EntityType;
      vatStatus?: VatStatus;
      channel?: FilingChannel;
      efpsGroup?: EfpsGroup;
      assignedUserId?: ID;
      tags?: string[];
      cursor?: string;
      limit?: number;
    }): Promise<Page<ClientSummary>>;
    get(id: ID): Promise<{ client: Client; summary: ClientSummary }>;
    upsert(c: Partial<Client>): Promise<Client>;
    archive(id: ID, reason: string): Promise<void>;
    restore(id: ID, reason: string): Promise<void>;
    revealTin(id: ID): Promise<string>;
    findDuplicates(c: { code?: string; tin?: string; name?: string }): Promise<ClientSummary[]>;
    importPreview(rows: Record<string, string>[], mapping: Record<string, keyof Client>): Promise<ImportPreview>;
    importCommit(preview: ImportPreview): Promise<{ created: ID[]; skipped: number; batchId: ID }>;
    importUndo(batchId: ID): Promise<void>;
  };

  contacts: {
    listByClient(clientId: ID): Promise<Contact[]>;
    upsert(c: Partial<Contact>): Promise<Contact>;
    remove(id: ID, reason: string): Promise<void>;
  };

  authorizations: {
    listByClient(clientId: ID): Promise<Authorization[]>;
    upsert(a: Partial<Authorization>): Promise<Authorization>;
    replace(oldId: ID, next: Partial<Authorization>): Promise<Authorization>;
  };

  templates: {
    list(f?: { active?: boolean }): Promise<TaskTemplate[]>;
    get(id: ID): Promise<{ template: TaskTemplate; lines: RequirementTemplate[] }>;
    save(t: Partial<TaskTemplate>, lines: Partial<RequirementTemplate>[]): Promise<TaskTemplate>;
    markVerified(id: ID, v: { sourceRef: string; sourceUrl?: string; verifiedOn: ISODate; note?: string }): Promise<TaskTemplate>;
  };

  deadlineMoves: {
    list(): Promise<DeadlineMove[]>;
    save(m: Partial<DeadlineMove>, applyToOpenTasks: boolean): Promise<{ move: DeadlineMove; updatedTaskIds: ID[] }>;
    remove(id: ID, reason: string): Promise<void>;
  };

  holidays: {
    list(year: number): Promise<Holiday[]>;
    save(h: Partial<Holiday>): Promise<Holiday>;
    remove(id: ID): Promise<void>;
  };

  tasks: {
    list(f?: {
      clientId?: ID;
      statuses?: TaskStatus[];
      statusGroup?: 'blocked' | 'in_progress' | 'ready' | 'submitted' | 'done';
      templateIds?: ID[];
      kinds?: TaskKind[];
      ownerUserId?: ID;
      dueFrom?: ISODate;
      dueTo?: ISODate;
      period?: PeriodKey;
      officeAction?: boolean;
      onVisit?: boolean;
      unverified?: boolean;
      ids?: ID[];
      search?: string;
      sort?: string;
      cursor?: string;
      limit?: number;
    }): Promise<Page<TaskSummary>>;
    get(id: ID): Promise<{
      task: Task;
      summary: TaskSummary;
      lines: TaskLine[];
      documents: DocumentFile[];
      visits: { visit: VisitSummary; item: VisitItem }[];
      payments: Payment[];
      followUps: FollowUpView[];
    }>;
    create(t: Partial<Task>, lines: Partial<TaskLine>[]): Promise<Task>;
    update(id: ID, t: Partial<Pick<Task, 'ownerUserId' | 'channel' | 'tags' | 'notes' | 'officeAction' | 'paymentExpected'>>): Promise<Task>;
    setStatus(id: ID, to: TaskStatus, reason?: string): Promise<Task>;
    markSubmitted(id: ID, s: { on: ISODate; via: FilingChannel | 'office'; ref?: string; ackDocumentId?: ID; note?: string }): Promise<Task>;
    markCompleted(id: ID, c: { on: ISODate; noEvidenceReason?: string }): Promise<Task>;
    override(id: ID, status: TaskStatus, reason: string): Promise<Task>;
    clearOverride(id: ID, reason: string): Promise<Task>;
    changeDue(id: ID, dueDate: ISODate, ref: string, reason: string, url?: string): Promise<Task>;
    setNextAction(id: ID, next: NextAction | null): Promise<Task>;
    archive(id: ID, reason: string): Promise<void>;
    restore(id: ID, reason: string): Promise<void>;
    duplicateForNextPeriod(id: ID): Promise<Task>;
    previewOpenPeriod(period: PeriodKey, clientIds: ID[]): Promise<OpenPeriodPreview>;
    openPeriod(plan: OpenPeriodPlan): Promise<{ created: ID[]; skipped: number; lines: number }>;
    board(f?: Parameters<Repositories['tasks']['list']>[0]): Promise<Record<TaskStatus, TaskSummary[]>>;
  };

  lines: {
    setStatus(id: ID, to: LineStatus, extra?: { note?: string; reason?: string; via?: Channel; on?: ISODate }): Promise<TaskLine>;
    addAdHoc(taskId: ID, line: Partial<TaskLine>): Promise<TaskLine>;
    update(id: ID, line: Partial<Pick<TaskLine, 'label' | 'required' | 'copyForm' | 'copies' | 'suppliedBy' | 'printAndBring' | 'neededBy'>>): Promise<TaskLine>;
    reorder(taskId: ID, orderedIds: ID[]): Promise<void>;
    history(id: ID): Promise<ActivityEvent[]>;
  };

  documents: {
    list(f?: {
      clientId?: ID;
      taskId?: ID;
      lineId?: ID;
      kind?: DocumentKind[];
      lineStatus?: LineStatus[];
      uploadedBy?: ID;
      from?: ISODate;
      to?: ISODate;
      search?: string;
      cursor?: string;
      limit?: number;
    }): Promise<Page<DocumentFile>>;
    upload(
      meta: {
        clientId: ID;
        taskId?: ID;
        lineId?: ID;
        visitItemId?: ID;
        paymentId?: ID;
        authorizationId?: ID;
        kind: DocumentKind;
        source: DocumentFile['source'];
      },
      file: Blob,
      thumb?: Blob,
      info?: { originalName: string; originalSizeBytes: number; sha256: string; pageCount?: number }
    ): Promise<DocumentFile>;
    replace(
      id: ID,
      file: Blob,
      thumb?: Blob,
      info?: { originalName: string; originalSizeBytes: number; sha256: string }
    ): Promise<DocumentFile>;
    update(id: ID, d: Partial<Pick<DocumentFile, 'kind' | 'lineId' | 'taskId'>>): Promise<DocumentFile>;
    remove(id: ID, reason: string): Promise<void>;
    getUrl(id: ID, purpose: 'view' | 'download' | 'thumb'): Promise<string>;
    findBySha(sha256: string, clientId: ID): Promise<DocumentFile[]>;
  };

  followUps: {
    list(f?: { state?: FollowUpState[]; clientId?: ID; taskId?: ID; cursor?: string; limit?: number }): Promise<Page<FollowUpView>>;
    get(id: ID): Promise<FollowUpView>;
    create(f: Partial<FollowUp>): Promise<FollowUp>;
    markSent(id: ID, a: { channel: Channel; sentAt: ISODateTime; expectedBy: ISODate; message: string }): Promise<FollowUpView>;
    logResponse(id: ID, r: { text: string; receivedLineIds: ID[]; via?: Channel }): Promise<FollowUpView>;
    escalate(id: ID, reason: string): Promise<FollowUpView>;
    resolve(id: ID, reason?: string): Promise<FollowUpView>;
  };

  messages: {
    list(): Promise<MessageTemplate[]>;
    save(m: Partial<MessageTemplate>): Promise<MessageTemplate>;
  };

  offices: {
    list(f?: { type?: OfficeType; search?: string }): Promise<Office[]>;
    get(id: ID): Promise<{ office: Office; stats: OfficeStats }>;
    save(o: Partial<Office>): Promise<Office>;
  };

  visits: {
    list(f?: { status?: VisitStatus[]; from?: ISODate; to?: ISODate; assigneeUserId?: ID; cursor?: string; limit?: number }): Promise<Page<VisitSummary>>;
    get(id: ID): Promise<VisitDetail>;
    create(v: Partial<Visit>, items?: { taskId: ID; action: VisitAction }[]): Promise<Visit>;
    update(id: ID, v: Partial<Pick<Visit, 'plannedDate' | 'arriveBy' | 'assigneeUserId' | 'purpose' | 'officeId'>>): Promise<Visit>;
    suggestTasks(visitId: ID): Promise<TaskSummary[]>;
    addItem(visitId: ID, taskId: ID, action: VisitAction): Promise<VisitItem>;
    updateItem(itemId: ID, i: Partial<Pick<VisitItem, 'intendedAction' | 'questions'>>): Promise<VisitItem>;
    removeItem(itemId: ID): Promise<void>;
    setPacked(visitId: ID, ref: { lineId?: ID; kitItemId?: ID }, packed: boolean): Promise<void>;
    start(id: ID, leaveAnywayReason?: string): Promise<Visit>;
    recordOutcome(
      itemId: ID,
      o: {
        outcome: Outcome;
        cause?: OutcomeCause;
        avoidable?: boolean;
        note?: string;
        windowOrOfficer?: string;
        nextAction?: NextAction;
        evidenceDocumentIds: ID[];
        requestedDocuments?: string[];
        affectedLineIds?: ID[];
      }
    ): Promise<VisitItem>;
    finish(id: ID, f: { finishedAt: ISODateTime; costs?: Visit['costs'] }): Promise<Visit>;
    cancel(id: ID, reason: string): Promise<void>;
  };

  visitKit: {
    list(): Promise<VisitKitItem[]>;
    save(i: Partial<VisitKitItem>): Promise<VisitKitItem>;
  };

  payments: {
    list(f?: {
      clientId?: ID;
      taskId?: ID;
      channel?: PaymentChannel;
      paidBy?: 'client' | 'operator';
      reimbursement?: 'waiting' | 'reimbursed';
      proofMissing?: boolean;
      from?: ISODate;
      to?: ISODate;
      cursor?: string;
      limit?: number;
    }): Promise<Page<Payment> & { totalAmount: Centavos }>;
    save(p: Partial<Payment>): Promise<Payment>;
    remove(id: ID, reason: string): Promise<void>;
  };

  notes: {
    list(entity: Note['entity'], entityId: ID): Promise<Note[]>;
    save(n: Partial<Note>): Promise<Note>;
  };

  savedViews: {
    list(page: SavedView['page']): Promise<SavedView[]>;
    save(v: Partial<SavedView>): Promise<SavedView>;
    remove(id: ID): Promise<void>;
  };

  notifications: {
    list(f?: { unread?: boolean; cursor?: string }): Promise<Page<Notification>>;
    markRead(ids: ID[] | 'all'): Promise<void>;
    unreadCount(): Promise<number>;
  };

  push: {
    subscribe(sub: PushSubscriptionJSON): Promise<void>;
    unsubscribe(endpoint: string): Promise<void>;
    test(): Promise<void>;
  };

  calendar: {
    range(from: ISODate, to: ISODate, f?: { clientId?: ID; ownerUserId?: ID; types?: CalendarItem['type'][] }): Promise<CalendarItem[]>;
  };

  insights: {
    get<T extends InsightsTab>(tab: T, f?: InsightsFilter): Promise<InsightsData[T]>;
  };

  baseline: {
    get(): Promise<Baseline | null>;
    save(b: Partial<Baseline>): Promise<Baseline>;
  };

  pulses: {
    list(): Promise<Pulse[]>;
    save(p: Partial<Pulse>): Promise<Pulse>;
  };

  reports: {
    clientChecklist(clientId: ID, taskIds?: ID[]): Promise<ClientChecklistReport>;
    clientHistory(clientId: ID, year: number): Promise<ClientHistoryReport>;
    monthlySummary(month: string): Promise<MonthlySummaryReport>;
    exportCsv(kind: 'clients' | 'tasks' | 'lines' | 'follow_ups' | 'visits' | 'payments' | 'activity', f?: Record<string, unknown>): Promise<Blob>;
    fullBackup(): Promise<Blob>;
  };

  activity: {
    list(f?: {
      entity?: ActivityEntity;
      entityId?: ID;
      clientId?: ID;
      actorId?: ID;
      actions?: ActivityAction[];
      from?: ISODate;
      to?: ISODate;
      cursor?: string;
      limit?: number;
    }): Promise<Page<ActivityEvent>>;
  };

  search: {
    query(q: string, f?: { types?: Array<keyof SearchResults> }): Promise<SearchResults>;
  };
}
