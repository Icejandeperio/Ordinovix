import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositories } from '@/data';
import type { InsightsTab, InsightsFilter, TaskStatus, LineStatus, VisitAction, Outcome, OutcomeCause, NextAction, Baseline } from '@/domain/types';

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => repositories.session.me(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrgSettings() {
  const { data: session } = useSession();
  return { data: session?.settings };
}


export function useToday(scope: 'mine' | 'everyone' = 'everyone') {
  return useQuery({
    queryKey: ['today', scope],
    queryFn: () => repositories.today.queue(scope),
    staleTime: 30 * 1000,
  });
}

export function useClients(filters?: Parameters<typeof repositories.clients.list>[0]) {
  return useQuery({
    queryKey: ['clients', filters],
    queryFn: () => repositories.clients.list(filters),
    staleTime: 30 * 1000,
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: () => repositories.clients.get(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

export function useTasks(filters?: Parameters<typeof repositories.tasks.list>[0]) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => repositories.tasks.list(filters),
    staleTime: 30 * 1000,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => repositories.tasks.get(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

export function useVisits(filters?: Parameters<typeof repositories.visits.list>[0]) {
  return useQuery({
    queryKey: ['visits', filters],
    queryFn: () => repositories.visits.list(filters),
    staleTime: 30 * 1000,
  });
}

export function useVisit(id: string) {
  return useQuery({
    queryKey: ['visit', id],
    queryFn: () => repositories.visits.get(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

export function useFollowUps(filters?: Parameters<typeof repositories.followUps.list>[0]) {
  return useQuery({
    queryKey: ['followUps', filters],
    queryFn: () => repositories.followUps.list(filters),
    staleTime: 30 * 1000,
  });
}

export function useOffices(filters?: Parameters<typeof repositories.offices.list>[0]) {
  return useQuery({
    queryKey: ['offices', filters],
    queryFn: () => repositories.offices.list(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePayments(filters?: Parameters<typeof repositories.payments.list>[0]) {
  return useQuery({
    queryKey: ['payments', filters],
    queryFn: () => repositories.payments.list(filters),
    staleTime: 30 * 1000,
  });
}

export function useCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ['calendar', from, to],
    queryFn: () => repositories.calendar.range(from, to),
    staleTime: 30 * 1000,
  });
}

export function useInsights<T extends InsightsTab>(tab: T, filters?: InsightsFilter) {
  return useQuery({
    queryKey: ['insights', tab, filters],
    queryFn: () => repositories.insights.get(tab, filters),
    staleTime: 60 * 1000,
    // A filter change keeps the charts on screen (dimmed) until the new numbers arrive; a tab change does not
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === tab ? previous : undefined),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => repositories.notifications.list(),
    staleTime: 30 * 1000,
  });
}

export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => repositories.notifications.unreadCount(),
    staleTime: 30 * 1000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: Parameters<typeof repositories.notifications.markRead>[0]) =>
      repositories.notifications.markRead(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
}

export function useAuditLog(filters?: Parameters<typeof repositories.activity.list>[0]) {
  return useQuery({
    queryKey: ['audit-log', filters],
    queryFn: () => repositories.activity.list(filters),
    staleTime: 30 * 1000,
  });
}

export function useContacts(clientId: string) {
  return useQuery({
    queryKey: ['contacts', clientId],
    queryFn: () => repositories.contacts.listByClient(clientId),
    enabled: Boolean(clientId),
    staleTime: 30 * 1000,
  });
}

export function useAuthorizations(clientId: string) {
  return useQuery({
    queryKey: ['authorizations', clientId],
    queryFn: () => repositories.authorizations.listByClient(clientId),
    enabled: Boolean(clientId),
    staleTime: 30 * 1000,
  });
}

export function useDocuments(filters?: Parameters<typeof repositories.documents.list>[0]) {
  return useQuery({
    queryKey: ['documents', filters],
    queryFn: () => repositories.documents.list(filters),
    staleTime: 30 * 1000,
  });
}

export function useMemberships(enabled = true) {
  return useQuery({
    queryKey: ['memberships'],
    queryFn: () => repositories.memberships.list(),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useInviteMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: Parameters<typeof repositories.memberships.invite>[0]) =>
      repositories.memberships.invite(m),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memberships'] });
      qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useUpdateMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof repositories.memberships.update>[1] }) =>
      repositories.memberships.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memberships'] });
      qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useRevokeMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repositories.memberships.revoke(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memberships'] });
      qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useNotes(entity: 'client' | 'task' | 'visit', entityId: string) {
  return useQuery({
    queryKey: ['notes', entity, entityId],
    queryFn: () => repositories.notes.list(entity, entityId),
    enabled: Boolean(entityId),
    staleTime: 10 * 1000,
  });
}

export function useSaveNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: Parameters<typeof repositories.notes.save>[0]) =>
      repositories.notes.save(note),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['notes', saved.entity, saved.entityId] });
    },
  });
}

// Client Mutations
export function useUpsertClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: Parameters<typeof repositories.clients.upsert>[0]) =>
      repositories.clients.upsert(c),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', saved.id] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useArchiveClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      repositories.clients.archive(id, reason),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', vars.id] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useRestoreClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      repositories.clients.restore(id, reason),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', vars.id] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useImportPreview() {
  return useMutation({
    mutationFn: ({
      rows,
      mapping,
    }: {
      rows: Record<string, string>[];
      mapping: Record<string, any>;
    }) => repositories.clients.importPreview(rows, mapping),
  });
}

export function useImportCommit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preview: Parameters<typeof repositories.clients.importCommit>[0]) =>
      repositories.clients.importCommit(preview),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useImportUndo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => repositories.clients.importUndo(batchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

// Contact Mutations
export function useUpsertContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contact: Parameters<typeof repositories.contacts.upsert>[0]) =>
      repositories.contacts.upsert(contact),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['contacts', saved.clientId] });
      qc.invalidateQueries({ queryKey: ['client', saved.clientId] });
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useRemoveContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clientId, reason }: { id: string; clientId: string; reason: string }) =>
      repositories.contacts.remove(id, reason),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['contacts', vars.clientId] });
      qc.invalidateQueries({ queryKey: ['client', vars.clientId] });
    },
  });
}

// Authorization Mutations
export function useUpsertAuthorization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (auth: Parameters<typeof repositories.authorizations.upsert>[0]) =>
      repositories.authorizations.upsert(auth),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['authorizations', saved.clientId] });
      qc.invalidateQueries({ queryKey: ['client', saved.clientId] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useReplaceAuthorization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ oldId, next }: { oldId: string; next: Parameters<typeof repositories.authorizations.upsert>[0] }) =>
      repositories.authorizations.replace(oldId, next),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['authorizations', saved.clientId] });
      qc.invalidateQueries({ queryKey: ['client', saved.clientId] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

// Task & Line Mutations
export function useSetLineStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to, extra }: { id: string; to: LineStatus; extra?: { note?: string; reason?: string } }) =>
      repositories.lines.setStatus(id, to, extra),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useSetTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to, reason }: { id: string; to: TaskStatus; reason?: string }) =>
      repositories.tasks.setStatus(id, to, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-board'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useTemplates(filters?: Parameters<typeof repositories.templates.list>[0]) {
  return useQuery({
    queryKey: ['templates', filters],
    queryFn: () => repositories.templates.list(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTaskBoard(filters?: Parameters<typeof repositories.tasks.board>[0]) {
  return useQuery({
    queryKey: ['task-board', filters],
    queryFn: () => repositories.tasks.board(filters),
    staleTime: 30 * 1000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      task,
      lines,
    }: {
      task: Parameters<typeof repositories.tasks.create>[0];
      lines: Parameters<typeof repositories.tasks.create>[1];
    }) => repositories.tasks.create(task, lines),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-board'] });
      qc.invalidateQueries({ queryKey: ['today'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useMarkTaskSubmitted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      submission,
    }: {
      id: string;
      submission: Parameters<typeof repositories.tasks.markSubmitted>[1];
    }) => repositories.tasks.markSubmitted(id, submission),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['task', saved.id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-board'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useMarkTaskCompleted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      completion,
    }: {
      id: string;
      completion: Parameters<typeof repositories.tasks.markCompleted>[1];
    }) => repositories.tasks.markCompleted(id, completion),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['task', saved.id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-board'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useOverrideTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: TaskStatus; reason: string }) =>
      repositories.tasks.override(id, status, reason),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['task', saved.id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-board'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useClearTaskOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      repositories.tasks.clearOverride(id, reason),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['task', saved.id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-board'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useChangeTaskDueDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dueDate,
      ref,
      reason,
    }: {
      id: string;
      dueDate: string;
      ref: string;
      reason: string;
    }) => repositories.tasks.changeDue(id, dueDate, ref, reason),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['task', saved.id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-board'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useSetTaskNextAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, next }: { id: string; next: NextAction | null }) =>
      repositories.tasks.setNextAction(id, next),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['task', saved.id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useArchiveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      repositories.tasks.archive(id, reason),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['task', vars.id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-board'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useAddChecklistLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      line,
    }: {
      taskId: string;
      line: Parameters<typeof repositories.lines.addAdHoc>[1];
    }) => repositories.lines.addAdHoc(taskId, line),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['task', saved.taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useOpenPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: Parameters<typeof repositories.tasks.openPeriod>[0]) =>
      repositories.tasks.openPeriod(plan),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-board'] });
      qc.invalidateQueries({ queryKey: ['today'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof repositories.tasks.update>[1] }) =>
      repositories.tasks.update(id, updates),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['task', saved.id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-board'] });
    },
  });
}

export function useDuplicateTaskForNextPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repositories.tasks.duplicateForNextPeriod(id),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-board'] });
    },
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      meta,
      file,
      thumb,
      info,
    }: {
      meta: Parameters<typeof repositories.documents.upload>[0];
      file: Blob;
      thumb?: Blob;
      info?: Parameters<typeof repositories.documents.upload>[3];
    }) => repositories.documents.upload(meta, file, thumb, info),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      if (saved.taskId) {
        qc.invalidateQueries({ queryKey: ['task', saved.taskId] });
      }
      if (saved.clientId) {
        qc.invalidateQueries({ queryKey: ['client', saved.clientId] });
      }
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useReplaceDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      file,
      thumb,
      info,
    }: {
      id: string;
      file: Blob;
      thumb?: Blob;
      info?: Parameters<typeof repositories.documents.replace>[3];
    }) => repositories.documents.replace(id, file, thumb, info),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof repositories.documents.update>[1] }) =>
      repositories.documents.update(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useRemoveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      repositories.documents.remove(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useMessageTemplates() {
  return useQuery({
    queryKey: ['messageTemplates'],
    queryFn: () => repositories.messages.list(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (f: Parameters<typeof repositories.followUps.create>[0]) =>
      repositories.followUps.create(f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['followUps'] });
      qc.invalidateQueries({ queryKey: ['today'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useMarkFollowUpSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: Parameters<typeof repositories.followUps.markSent>[1];
    }) => repositories.followUps.markSent(id, action),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['followUps'] });
      qc.invalidateQueries({ queryKey: ['today'] });
      if (updated.task?.id) {
        qc.invalidateQueries({ queryKey: ['task', updated.task.id] });
      }
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useLogFollowUpResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      response,
    }: {
      id: string;
      response: Parameters<typeof repositories.followUps.logResponse>[1];
    }) => repositories.followUps.logResponse(id, response),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['followUps'] });
      qc.invalidateQueries({ queryKey: ['today'] });
      if (updated.task?.id) {
        qc.invalidateQueries({ queryKey: ['task', updated.task.id] });
      }
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useEscalateFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      repositories.followUps.escalate(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['followUps'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useResolveFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      repositories.followUps.resolve(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['followUps'] });
      qc.invalidateQueries({ queryKey: ['today'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useOffice(id: string) {
  return useQuery({
    queryKey: ['office', id],
    queryFn: () => repositories.offices.get(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveOffice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (o: Parameters<typeof repositories.offices.save>[0]) =>
      repositories.offices.save(o),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offices'] });
    },
  });
}

export function useCreateVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      visit,
      items,
    }: {
      visit: Parameters<typeof repositories.visits.create>[0];
      items?: Parameters<typeof repositories.visits.create>[1];
    }) => repositories.visits.create(visit, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useUpdateVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Parameters<typeof repositories.visits.update>[1];
    }) => repositories.visits.update(id, updates),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['visit', id] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useSetVisitPacked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      visitId,
      ref,
      packed,
    }: {
      visitId: string;
      ref: Parameters<typeof repositories.visits.setPacked>[1];
      packed: boolean;
    }) => repositories.visits.setPacked(visitId, ref, packed),
    onSuccess: (_, { visitId }) => {
      qc.invalidateQueries({ queryKey: ['visit', visitId] });
    },
  });
}

export function useStartVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, leaveAnywayReason }: { id: string; leaveAnywayReason?: string }) =>
      repositories.visits.start(id, leaveAnywayReason),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['visit', id] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useRecordVisitOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      outcome,
    }: {
      itemId: string;
      outcome: Parameters<typeof repositories.visits.recordOutcome>[1];
    }) => repositories.visits.recordOutcome(itemId, outcome),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['visit'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useFinishVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof repositories.visits.finish>[1];
    }) => repositories.visits.finish(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['visit', id] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useCancelVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      repositories.visits.cancel(id, reason),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['visit', id] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useSuggestVisitTasks(visitId: string) {
  return useQuery({
    queryKey: ['suggestVisitTasks', visitId],
    queryFn: () => repositories.visits.suggestTasks(visitId),
    enabled: Boolean(visitId),
  });
}

export function useSavePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Parameters<typeof repositories.payments.save>[0]) =>
      repositories.payments.save(p),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['task', saved.taskId] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useRemovePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      repositories.payments.remove(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useChangeTaskDue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dueDate,
      ref,
      reason,
    }: {
      id: string;
      dueDate: string;
      ref?: string;
      reason: string;
    }) => repositories.tasks.changeDue(id, dueDate, ref || '', reason),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['task', updated.id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useBaseline() {
  return useQuery({
    queryKey: ['baseline'],
    queryFn: () => repositories.baseline.get(),
    staleTime: 60 * 1000,
  });
}

export function useSaveBaseline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Partial<Baseline>) => repositories.baseline.save(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baseline'] });
      qc.invalidateQueries({ queryKey: ['insights'] });
    },
  });
}

export function useTemplateLines(id: string) {
  return useQuery({
    queryKey: ['templates', 'detail', id],
    queryFn: () => repositories.templates.get(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMarkTemplateVerified() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      verification,
    }: {
      id: string;
      verification: Parameters<typeof repositories.templates.markVerified>[1];
    }) => repositories.templates.markVerified(id, verification),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

// ---- Settings ----

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Parameters<typeof repositories.settings.save>[0]) => repositories.settings.save(s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useSavePrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Parameters<typeof repositories.prefs.save>[0]) => repositories.prefs.save(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useSaveMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: Parameters<typeof repositories.messages.save>[0]) => repositories.messages.save(m),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messageTemplates'] });
    },
  });
}

export function useHolidays(year: number) {
  return useQuery({
    queryKey: ['holidays', year],
    queryFn: () => repositories.holidays.list(year),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (h: Parameters<typeof repositories.holidays.save>[0]) => repositories.holidays.save(h),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}

export function useRemoveHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repositories.holidays.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}

export function useDeadlineMoves() {
  return useQuery({
    queryKey: ['deadlineMoves'],
    queryFn: () => repositories.deadlineMoves.list(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRemoveDeadlineMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => repositories.deadlineMoves.remove(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deadlineMoves'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useVisitKit() {
  return useQuery({
    queryKey: ['visitKit'],
    queryFn: () => repositories.visitKit.list(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveVisitKitItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: Parameters<typeof repositories.visitKit.save>[0]) => repositories.visitKit.save(i),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitKit'] });
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['visit'] });
    },
  });
}

// ---- Audit log ----

export function useActivity(filters?: Parameters<typeof repositories.activity.list>[0], enabled = true) {
  return useQuery({
    queryKey: ['activity', filters],
    queryFn: () => repositories.activity.list(filters),
    enabled,
    staleTime: 10 * 1000,
  });
}
