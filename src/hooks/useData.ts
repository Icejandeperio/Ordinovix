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

export function useAuditLog(filters?: Parameters<typeof repositories.activity.list>[0]) {
  return useQuery({
    queryKey: ['audit-log', filters],
    queryFn: () => repositories.activity.list(filters),
    staleTime: 30 * 1000,
  });
}

// Mutations
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
