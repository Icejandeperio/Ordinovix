import React from 'react';
import { useNotifications } from '@/hooks/useData';
import { Bell, CheckCheck } from 'lucide-react';
import { repositories } from '@/data';

export function NotificationsPage() {
  const { data, isLoading } = useNotifications();
  const notifications = data?.items || [];

  const handleMarkAllRead = async () => {
    await repositories.notifications.markRead('all');
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">Notifications</h1>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Deadline alerts, document reviews received, and trip preparation reminders
          </p>
        </div>
        {notifications.length > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="px-3 py-1.5 text-xs font-semibold rounded-control bg-sheet-2 border border-rule text-ink hover:bg-sheet-3 flex items-center gap-1.5"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="p-12 text-center bg-sheet border border-rule rounded-panel text-ink-3">
          <Bell className="w-8 h-8 text-ink-3 mx-auto mb-2" />
          <p className="text-sm font-semibold text-ink">No notifications at this time</p>
        </div>
      ) : (
        <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs">
          {notifications.map((n) => (
            <div key={n.id} className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-ink">{n.title}</h4>
                {!n.readAt && <span className="w-2 h-2 rounded-full bg-stamp" />}
              </div>
              <p className="text-xs text-ink-2">{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
