import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, useMarkNotificationsRead } from '@/hooks/useData';
import { formatTime, formatDate, formatRelative } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, Inbox, Check } from 'lucide-react';
import type { Notification } from '@/domain/types';
import { QueryState } from '@/components/ui/query-state';

export function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { data, isLoading, isError, error, refetch } = useNotifications();
  const markRead = useMarkNotificationsRead();

  const notifications = data?.items || [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const filtered = filter === 'unread' ? notifications.filter((n) => !n.readAt) : notifications;

  // Group notifications by calendar day (YYYY-MM-DD)
  const groupedByDay: Record<string, Notification[]> = {};
  filtered.forEach((n) => {
    const day = n.createdAt.slice(0, 10);
    if (!groupedByDay[day]) groupedByDay[day] = [];
    groupedByDay[day].push(n);
  });

  const sortedDays = Object.keys(groupedByDay).sort((a, b) => b.localeCompare(a));

  const handleItemClick = (n: Notification) => {
    if (!n.readAt) {
      markRead.mutate([n.id]);
    }
    if (n.link) {
      navigate(n.link);
    }
  };

  const handleMarkAllRead = () => {
    markRead.mutate('all');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink font-sans">
            Notifications
          </h1>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Filing reminders, document submissions received, and trip updates
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markRead.isPending}
            className="self-start sm:self-auto"
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
            <span>Mark all as read</span>
          </Button>
        )}
      </div>

      {/* Filter Tabs per Spec 11.15 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-chip text-xs font-semibold transition-colors border ${
            filter === 'all'
              ? 'bg-sheet text-ink border-rule shadow-xs'
              : 'bg-sheet-2 text-ink-3 border-transparent hover:text-ink'
          }`}
        >
          All ({notifications.length})
        </button>

        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 rounded-chip text-xs font-semibold transition-colors border flex items-center gap-1.5 ${
            filter === 'unread'
              ? 'bg-sheet text-ink border-rule shadow-xs'
              : 'bg-sheet-2 text-ink-3 border-transparent hover:text-ink'
          }`}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-chip bg-stamp text-on-stamp text-[10px] font-mono">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notifications grouped by day */}
      {isError ? (
        <QueryState isLoading={false} isError error={error} onRetry={() => refetch()} subject="notifications">
          {null}
        </QueryState>
      ) : isLoading ? (
        <div className="p-12 text-center space-y-2 bg-sheet border border-rule rounded-panel">
          <div className="w-6 h-6 border-2 border-stamp border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-ink-3">Loading notifications...</p>
        </div>
      ) : sortedDays.length === 0 ? (
        <div className="p-12 text-center bg-sheet border border-rule rounded-panel space-y-3">
          <Inbox className="w-10 h-10 text-ink-3 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-ink">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
            </h3>
            <p className="text-xs text-ink-3">
              {filter === 'unread'
                ? "You've caught up with all activity alerts and reminders."
                : 'Activity alerts and reminders will appear here.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDays.map((day) => {
            const dayNotifications = groupedByDay[day];
            return (
              <div key={day} className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-ink-3 font-sans px-1">
                  {formatRelative(day)}
                </div>

                <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs overflow-hidden">
                  {dayNotifications.map((n) => {
                    const isUnread = !n.readAt;
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleItemClick(n)}
                        className={`p-4 flex items-start gap-3.5 cursor-pointer transition-colors hover:bg-sheet-2 ${
                          isUnread ? 'bg-stamp-soft/20' : 'bg-sheet'
                        }`}
                      >
                        {/* 6px --stamp dot per Spec 11.15 */}
                        <div className="pt-1 shrink-0">
                          {isUnread ? (
                            <span className="block w-2 h-2 rounded-full bg-stamp shadow-xs" />
                          ) : (
                            <span className="block w-2 h-2 rounded-full bg-transparent" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4
                              className={`text-xs sm:text-sm truncate ${
                                isUnread ? 'font-semibold text-ink' : 'font-normal text-ink-2'
                              }`}
                            >
                              {n.title}
                            </h4>
                            <span className="text-[11px] text-ink-3 shrink-0">
                              {formatTime(n.createdAt)}
                            </span>
                          </div>

                          <p
                            className={`text-xs leading-relaxed ${
                              isUnread ? 'text-ink font-medium' : 'text-ink-2'
                            }`}
                          >
                            {n.body}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
