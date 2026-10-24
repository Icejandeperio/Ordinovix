import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
} from 'lucide-react';
import {
  format,
  parseISO,
  isValid,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameDay,
  addDays,
  nextMonday,
} from 'date-fns';
import * as chrono from 'chrono-node';
import { todayInManila, formatRelative, formatDate } from '@/lib/dates';

export interface DateFieldProps {
  value?: string | null; // 'YYYY-MM-DD'
  onChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
  hint?: string;
  showRelativeHint?: boolean;
  minDate?: string;
  maxDate?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function DateField({
  value,
  onChange,
  label,
  placeholder = 'Select or type date (e.g. Oct 28, +3)...',
  hint,
  showRelativeHint = true,
  className = '',
  disabled = false,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (value && isValid(parseISO(value))) {
      return parseISO(value);
    }
    return parseISO(todayInManila());
  });

  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const todayStr = todayInManila();
  const todayDate = parseISO(todayStr);

  // Sync displayed text input with prop value
  useEffect(() => {
    if (value && isValid(parseISO(value))) {
      setInputValue(formatDate(value));
      setCurrentMonth(parseISO(value));
    } else {
      setInputValue('');
    }
  }, [value]);

  // Click outside to close popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Handle typed natural language input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputValue(text);

    if (!text.trim()) {
      onChange(null);
      return;
    }

    // Try parsing ISO first (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) {
      const parsed = parseISO(text.trim());
      if (isValid(parsed)) {
        const iso = format(parsed, 'yyyy-MM-dd');
        onChange(iso);
        setCurrentMonth(parsed);
        return;
      }
    }

    // Try relative offset (e.g. +3, +7)
    if (/^\+\d+$/.test(text.trim())) {
      const days = parseInt(text.trim().slice(1), 10);
      const target = addDays(todayDate, days);
      const iso = format(target, 'yyyy-MM-dd');
      onChange(iso);
      setCurrentMonth(target);
      return;
    }

    // Try Chrono NLP parsing (e.g. 'Oct 28', 'tomorrow', 'next fri', 'today')
    try {
      const parsedDate = chrono.parseDate(text, todayDate);
      if (parsedDate && isValid(parsedDate)) {
        const iso = format(parsedDate, 'yyyy-MM-dd');
        onChange(iso);
        setCurrentMonth(parsedDate);
      }
    } catch {
      // Keep typing
    }
  };

  const handleSelectDate = (date: Date) => {
    const iso = format(date, 'yyyy-MM-dd');
    onChange(iso);
    setInputValue(formatDate(iso));
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setInputValue('');
    setOpen(false);
  };

  const handleQuickChip = (targetDate: Date) => {
    handleSelectDate(targetDate);
  };

  // Calendar month days calculation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart); // 0 = Sunday, 1 = Monday ...

  const selectedDate = value && isValid(parseISO(value)) ? parseISO(value) : null;

  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className={`space-y-1 relative ${className}`} ref={popoverRef}>
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
          {label}
        </label>
      )}

      {/* Input Field */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full h-9 pl-3 pr-9 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-xs text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--stamp)] focus:border-transparent transition-all shadow-xs"
        />

        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={disabled}
          className="absolute right-2.5 p-1 rounded text-[var(--ink-3)] hover:text-[var(--stamp-ink)] hover:bg-[var(--sheet-2)] transition-colors cursor-pointer"
          title="Open custom date picker"
          aria-label="Open date picker"
        >
          <CalendarIcon className="w-4 h-4 text-[var(--stamp)]" />
        </button>
      </div>

      {/* Relative Day & Weekday Hint */}
      {showRelativeHint && value && (
        <div className="text-[11px] text-[var(--ink-3)] flex items-center gap-1.5 pl-0.5">
          <span className="font-semibold text-[var(--stamp-ink)]">
            {formatRelative(value)}
          </span>
          <span>·</span>
          <span>{format(parseISO(value), 'EEEE')}</span>
          {hint && (
            <>
              <span>·</span>
              <span>{hint}</span>
            </>
          )}
        </div>
      )}

      {/* Custom Designed Calendar Popover */}
      {open && (
        <div className="absolute left-0 mt-1.5 w-[310px] rounded-xl bg-[var(--sheet)] border border-[var(--rule)] shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 select-none">
          {/* Header Month / Navigation */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--rule)]">
            <button
              type="button"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1.5 rounded-md hover:bg-[var(--sheet-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors cursor-pointer"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center font-bold text-xs text-[var(--ink)] tracking-tight font-sans">
              {format(currentMonth, 'MMMM yyyy')}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setCurrentMonth(todayDate);
                  handleSelectDate(todayDate);
                }}
                className="px-2 py-0.5 text-[10px] font-bold rounded bg-[var(--stamp-soft)] text-[var(--stamp-ink)] hover:bg-[var(--stamp-soft)]/80 transition-colors cursor-pointer"
                title="Select today"
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1.5 rounded-md hover:bg-[var(--sheet-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 pt-2 pb-1 text-center font-semibold text-[10px] text-[var(--ink-3)] uppercase tracking-wider">
            {weekdays.map((w, idx) => (
              <div key={w} className={idx === 0 || idx === 6 ? 'text-[var(--ink-3)] font-normal' : ''}>
                {w}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 pt-1 pb-2">
            {/* Empty slots before first day of month (no ugly spillover) */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="w-9 h-9" />
            ))}

            {/* Days in Month */}
            {daysInMonth.map((day) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isToday = isSameDay(day, todayDate);
              const dayOfWeek = getDay(day);
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              return (
                <button
                  key={dayStr}
                  type="button"
                  onClick={() => handleSelectDate(day)}
                  className={`w-9 h-9 text-xs rounded-md flex items-center justify-center font-mono font-medium transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-[var(--stamp)] text-[var(--on-stamp)] font-bold shadow-xs'
                      : isToday
                      ? 'border border-[var(--stamp)] text-[var(--stamp-ink)] font-bold bg-[var(--stamp-soft)]/40 hover:bg-[var(--stamp-soft)]'
                      : isWeekend
                      ? 'text-[var(--ink-3)] hover:bg-[var(--sheet-2)] hover:text-[var(--ink)]'
                      : 'text-[var(--ink)] hover:bg-[var(--sheet-2)]'
                  }`}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Quick Preset Chips Bar */}
          <div className="pt-2.5 border-t border-[var(--rule)] space-y-2">
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => handleQuickChip(todayDate)}
                className="px-2 py-0.5 text-[10px] font-semibold rounded bg-[var(--sheet-2)] text-[var(--ink-2)] hover:bg-[var(--stamp-soft)] hover:text-[var(--stamp-ink)] transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleQuickChip(addDays(todayDate, 1))}
                className="px-2 py-0.5 text-[10px] font-semibold rounded bg-[var(--sheet-2)] text-[var(--ink-2)] hover:bg-[var(--stamp-soft)] hover:text-[var(--stamp-ink)] transition-colors cursor-pointer"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => handleQuickChip(nextMonday(todayDate))}
                className="px-2 py-0.5 text-[10px] font-semibold rounded bg-[var(--sheet-2)] text-[var(--ink-2)] hover:bg-[var(--stamp-soft)] hover:text-[var(--stamp-ink)] transition-colors cursor-pointer"
              >
                Next Mon
              </button>
              <button
                type="button"
                onClick={() => handleQuickChip(addDays(todayDate, 7))}
                className="px-2 py-0.5 text-[10px] font-semibold rounded bg-[var(--sheet-2)] text-[var(--ink-2)] hover:bg-[var(--stamp-soft)] hover:text-[var(--stamp-ink)] transition-colors cursor-pointer"
              >
                +7 Days
              </button>
              <button
                type="button"
                onClick={() => handleQuickChip(endOfMonth(todayDate))}
                className="px-2 py-0.5 text-[10px] font-semibold rounded bg-[var(--sheet-2)] text-[var(--ink-2)] hover:bg-[var(--stamp-soft)] hover:text-[var(--stamp-ink)] transition-colors cursor-pointer"
              >
                End of Month
              </button>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] font-medium text-[var(--ink-3)] hover:text-[var(--critical-solid)] transition-colors cursor-pointer"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-md bg-[var(--stamp)] text-[var(--on-stamp)] hover:bg-[var(--stamp-strong)] transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
