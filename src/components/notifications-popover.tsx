import React, { useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications, useMarkNotificationsRead } from '@/hooks/useData';
import { formatTime, formatRelative } from '@/lib/format';
import { Bell, Check, CheckCheck, ExternalLink, Inbox } from 'lucide-react';
import type { Notification } from '@/domain/types';

interface NotificationsPopoverProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationsPopover({ open, onClose }: NotificationsPopoverProps) {
  const navigate = useNavigate();
  const popoverRef = useRef<HTMLDivElement>(null);
  const { data: notifsData, isLoading } = useNotifications();
  const markRead = useMarkNotificationsRead();

  const notifications = notifsData?.items || [];
  const latestTen = notifications.slice(0, 10);
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open, onClose]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const handleItemClick = (n: Notification) => {
    if (!n.readAt) {
      markRead.mutate([n.id]);
    }
    onClose();
    if (n.link) {
      navigate(n.link);
    }
  };

  const handleMarkAllRead = () => {
    markRead.mutate('all');
  };

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 w-[380px] sm:w-[400px] bg-sheet border border-rule rounded-panel shadow-2xl z-50 overflow-hidden flex flex-col max-h-[500px]"
      role="dialog"
      aria-label="Notifications"
    >
      {/* Header */}
      <div className="p-3.5 border-b border-rule flex items-center justify-between shrink-0 bg-sheet">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-ink">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-chip text-[11px] font-bold bg-stamp-soft text-stamp-strong">
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs font-semibold text-stamp hover:underline flex items-center gap-1"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-rule scrollbar-none">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-ink-3">Loading notifications...</div>
        ) : latestTen.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Inbox className="w-8 h-8 text-ink-3 mx-auto" />
            <p className="text-xs text-ink-3">You're all caught up!</p>
          </div>
        ) : (
          latestTen.map((n) => {
            const isUnread = !n.readAt;
            return (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors hover:bg-sheet-2 ${
                  isUnread ? 'bg-stamp-soft/20' : 'bg-sheet'
                }`}
              >
                {/* 6px --stamp dot per Spec 11.15 */}
                <div className="pt-1.5 shrink-0">
                  {isUnread ? (
                    <span className="block w-2 h-2 rounded-full bg-stamp shadow-xs" />
                  ) : (
                    <span className="block w-2 h-2 rounded-full bg-transparent" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <div
                    className={`text-xs truncate ${
                      isUnread ? 'font-semibold text-ink' : 'font-normal text-ink-2'
                    }`}
                  >
                    {n.title}
                  </div>
                  <p className="text-xs text-ink-2 line-clamp-2 leading-relaxed">
                    {n.body}
                  </p>
                  <div className="text-[10px] text-ink-3 pt-0.5">
                    {formatRelative(n.createdAt.slice(0, 10))} · {formatTime(n.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer "See all" per Spec 11.15 */}
      <div className="p-2.5 border-t border-rule bg-sheet-2 text-center shrink-0">
        <Link
          to="/notifications"
          onClick={onClose}
          className="text-xs font-bold text-stamp hover:underline block w-full py-1"
        >
          See all notifications &rarr;
        </Link>
      </div>
    </div>
  );
}
