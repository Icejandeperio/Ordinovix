import React from 'react';
import {
  CircleDashed,
  Send,
  Inbox,
  ScanEye,
  BadgeCheck,
  CircleAlert,
  PencilLine,
  MinusCircle,
  CircleDot,
  Lock,
  Pencil,
  UserCheck,
  CircleCheck,
  Clock,
  CircleCheckBig,
  Archive,
  Hourglass,
  AlarmClock,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { daysFromToday, formatDate } from '@/lib/dates';
import {
  LINE_STATUS_META,
  TASK_STATUS_META,
  type StatusMeta,
} from '@/domain/labels';
import type { LineStatus, TaskStatus, DueState, AuthorizationState } from '@/domain/types';

// Map icon string to Lucide component
const ICON_MAP: Record<string, React.ElementType> = {
  CircleDashed,
  Send,
  Inbox,
  ScanEye,
  BadgeCheck,
  CircleAlert,
  PencilLine,
  MinusCircle,
  CircleDot,
  Lock,
  Pencil,
  UserCheck,
  CircleCheck,
  Clock,
  CircleCheckBig,
  Archive,
};

const TONE_CLASSES: Record<StatusMeta['tone'], string> = {
  neutral: 'text-neutral-fg bg-neutral-bg border-neutral-bd',
  info: 'text-info-fg bg-info-bg border-info-bd',
  warn: 'text-warn-fg bg-warn-bg border-warn-bd',
  serious: 'text-serious-fg bg-serious-bg border-serious-bd',
  critical: 'text-critical-fg bg-critical-bg border-critical-bd',
  good: 'text-good-fg bg-good-bg border-good-bd',
};

// ===== 9.7 StatusChip (Task Status) =====
export interface StatusChipProps {
  status: TaskStatus;
  className?: string;
}

export function StatusChip({ status, className }: StatusChipProps) {
  const meta = TASK_STATUS_META[status] || {
    label: status,
    tone: 'neutral',
    icon: 'CircleDot',
  };
  const Icon = ICON_MAP[meta.icon] || CircleDot;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-chip text-xs font-semibold border select-none h-6 whitespace-nowrap shrink-0',
        TONE_CLASSES[meta.tone],
        className
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{meta.label}</span>
    </span>
  );
}

// ===== 9.7 LineChip (Line Status) =====
export interface LineChipProps {
  status: LineStatus;
  onClick?: () => void;
  className?: string;
}

export function LineChip({ status, onClick, className }: LineChipProps) {
  const meta = LINE_STATUS_META[status] || {
    label: status,
    tone: 'neutral',
    icon: 'CircleDashed',
  };
  const Icon = ICON_MAP[meta.icon] || CircleDashed;

  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-chip text-xs font-semibold border select-none h-6 whitespace-nowrap shrink-0',
        TONE_CLASSES[meta.tone],
        onClick && 'cursor-pointer hover:opacity-90 active:scale-95 transition-all',
        className
      )}
      onClick={onClick}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{meta.label}</span>
    </span>
  );

  return content;
}

// ===== 9.7 DueBadge =====
export interface DueBadgeProps {
  state?: DueState;
  daysDiff?: number;
  dueDate?: string;
  isCompleted?: boolean;
  completedDate?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function DueBadge({
  state,
  daysDiff,
  dueDate,
  isCompleted = false,
  completedDate,
  className,
  size = 'md',
}: DueBadgeProps) {
  const isSmall = size === 'sm';
  const sizeClasses = isSmall
    ? 'text-[10px] px-1.5 py-0 h-5 gap-1'
    : 'text-xs px-2 py-0.5 h-6 gap-1';
  const iconClasses = isSmall ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0';

  if (isCompleted) {
    const formattedDone = completedDate ? formatDate(completedDate) : 'recently';
    return (
      <span
        title={completedDate ? `Completed on ${completedDate}` : undefined}
        className={cn(
          'inline-flex items-center rounded-chip font-semibold border select-none whitespace-nowrap shrink-0',
          sizeClasses,
          'text-neutral-fg bg-neutral-bg border-neutral-bd',
          className
        )}
      >
        <CircleCheck className={iconClasses} />
        <span>Done {formattedDone}</span>
      </span>
    );
  }

  // Calculate actual day difference from dueDate if provided, else use daysDiff
  const hasExplicitDays = daysDiff !== undefined;
  const computedDays = dueDate ? daysFromToday(dueDate) : hasExplicitDays ? daysDiff : undefined;

  // Resolve effective due state: auto-derive if dueDate provided, or sanitize 0-day boundaries
  let effectiveState: DueState = state || 'ok';
  if (computedDays !== undefined) {
    if (computedDays < 0) effectiveState = 'overdue';
    else if (computedDays === 0) effectiveState = 'due_today';
    else if (computedDays <= 7) effectiveState = 'due_soon';
    else effectiveState = 'ok';
  }

  const tooltip = dueDate ? `Due date: ${dueDate}` : undefined;
  const formattedDate = dueDate ? formatDate(dueDate) : 'later';

  if (effectiveState === 'overdue') {
    const absDays = computedDays !== undefined ? Math.abs(computedDays) : undefined;
    const label = absDays !== undefined && absDays > 0 ? `Overdue ${absDays}d` : 'Overdue';

    return (
      <span
        title={tooltip}
        className={cn(
          'inline-flex items-center rounded-chip font-semibold border select-none whitespace-nowrap shrink-0',
          sizeClasses,
          'text-critical-fg bg-critical-bg border-critical-bd',
          className
        )}
      >
        <AlarmClock className={cn(iconClasses, 'animate-pulse')} />
        <span>{label}</span>
      </span>
    );
  }

  if (effectiveState === 'due_today') {
    return (
      <span
        title={tooltip}
        className={cn(
          'inline-flex items-center rounded-chip font-semibold border select-none whitespace-nowrap shrink-0',
          sizeClasses,
          'text-warn-fg bg-warn-bg border-warn-bd',
          className
        )}
      >
        <Clock className={iconClasses} />
        <span>Due today</span>
      </span>
    );
  }

  if (effectiveState === 'due_soon') {
    const label =
      computedDays !== undefined
        ? computedDays === 1
          ? 'Due tomorrow'
          : computedDays > 1
            ? `Due in ${computedDays}d`
            : 'Due today'
        : 'Due soon';

    return (
      <span
        title={tooltip}
        className={cn(
          'inline-flex items-center rounded-chip font-semibold border select-none whitespace-nowrap shrink-0',
          sizeClasses,
          'text-warn-fg bg-warn-bg border-warn-bd',
          className
        )}
      >
        <Hourglass className={iconClasses} />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span
      title={tooltip}
      className={cn(
        'inline-flex items-center rounded-chip font-semibold border select-none whitespace-nowrap shrink-0',
        sizeClasses,
        'text-neutral-fg bg-neutral-bg border-neutral-bd',
        className
      )}
    >
      <Clock className={iconClasses} />
      <span>Due {formattedDate}</span>
    </span>
  );
}

// ===== 9.7 AuthorizationBadge =====
export interface AuthorizationBadgeProps {
  state: AuthorizationState | 'none';
  detail?: string;
  className?: string;
}

export function AuthorizationBadge({ state, detail, className }: AuthorizationBadgeProps) {
  const formattedDetail = detail ? (detail.includes('-') ? formatDate(detail) : detail) : '';

  if (state === 'valid') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-chip text-xs font-semibold border select-none h-6 whitespace-nowrap shrink-0',
          'text-good-fg bg-good-bg border-good-bd',
          className
        )}
      >
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span>Valid {formattedDetail ? `to ${formattedDetail}` : ''}</span>
      </span>
    );
  }

  if (state === 'expiring') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-chip text-xs font-semibold border select-none h-6 whitespace-nowrap shrink-0',
          'text-warn-fg bg-warn-bg border-warn-bd',
          className
        )}
      >
        <Hourglass className="w-3.5 h-3.5 shrink-0" />
        <span>Expires {formattedDetail ? `in ${formattedDetail}` : 'soon'}</span>
      </span>
    );
  }

  if (state === 'expired') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-chip text-xs font-semibold border select-none h-6 whitespace-nowrap shrink-0',
          'text-critical-fg bg-critical-bg border-critical-bd',
          className
        )}
      >
        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
        <span>Expired {formattedDetail || ''}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-chip text-xs font-semibold border select-none h-6 whitespace-nowrap shrink-0',
        'text-critical-fg bg-critical-bg border-critical-bd',
        className
      )}
    >
      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
      <span>No authorization</span>
    </span>
  );
}

// ===== 9.7 ReadinessMeter =====
export interface ReadinessMeterProps {
  total: number;
  ready: number;
  label?: string;
  className?: string;
}

export function ReadinessMeter({ total, ready, label, className }: ReadinessMeterProps) {
  const isComplete = total > 0 && ready === total;

  return (
    <div className={cn('space-y-1.5', className)} aria-label={`${ready} of ${total} ready`}>
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-ink-2">{label || 'Readiness'}</span>
        <span className={cn('tabular-nums font-bold', isComplete ? 'text-good-fg' : 'text-ink-3')}>
          {ready} of {total} ready
        </span>
      </div>
      <div className="flex gap-1 h-2 w-full">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 rounded-[2px] transition-all duration-slow',
              i < ready ? 'bg-good-solid shadow-xs' : 'bg-sheet-3'
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ===== 9.7 ClientFlags =====
export function ClientFlag({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider whitespace-nowrap shrink-0',
        'bg-sheet-2 text-ink-3 border border-rule',
        className
      )}
    >
      {label}
    </span>
  );
}
