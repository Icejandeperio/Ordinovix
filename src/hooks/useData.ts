import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositories } from '@/data';
import type { InsightsTab, InsightsFilter, TaskStatus, LineStatus, VisitAction, Outcome, OutcomeCause, NextAction } from '@/domain/types';

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => repositories.session.me(),
    staleTime: 5 * 60 * 1000,
  });
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

export function useMemberships() {
  return useQuery({
    queryKey: ['memberships'],
    queryFn: () => repositories.memberships.list(),
    staleTime: 5 * 60 * 1000,
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
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}
