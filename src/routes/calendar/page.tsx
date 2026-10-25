import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useCalendar,
  useClients,
  useUpdateVisit,
  useChangeTaskDue,
  useOrgSettings,
} from '@/hooks/useData';
import type { CalendarItem, ID } from '@/domain/types';
import { todayInManila, formatDate, addDaysToDate } from '@/lib/dates';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MapPin,
  Lock,
  Hourglass,
  MessageCircleMore,
  Info,
  Clock,
  Building2,
  CheckCircle2,
  AlertTriangle,
  MoveHorizontal,
  X,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

type CalendarView = 'month' | 'week' | 'agenda';
type ItemTypeFilter = 'all' | 'task_due' | 'visit' | 'follow_up' | 'holiday' | 'authorization_expiry';

export function CalendarPage() {
  const navigate = useNavigate();
  const todayStr = todayInManila();
  const todayDate = useMemo(() => {
    const [y, m, d] = todayStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [todayStr]);

  const { data: orgSettings } = useOrgSettings();
  const weekStartsOn = orgSettings?.weekStartsOn ?? 0; // 0 = Sunday

  const [currentDate, setCurrentDate] = useState<Date>(todayDate);
  const [view, setView] = useState<CalendarView>('month');
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('all');
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  // Selected Day for Popover / Modal
  const [selectedDayItems, setSelectedDayItems] = useState<{
    dateStr: string;
    items: CalendarItem[];
  } | null>(null);

  // Reschedule Task Due Dialog State
  const [taskToReschedule, setTaskToReschedule] = useState<{
    taskId: ID;
    currentDue: string;
    taskTitle: string;
  } | null>(null);
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>('');
  const [rescheduleSourceRef, setRescheduleSourceRef] = useState<string>('BIR Revenue Memorandum Circular');
  const [rescheduleReason, setRescheduleReason] = useState<string>('');

  // Reschedule Visit Dialog State
  const [visitToReschedule, setVisitToReschedule] = useState<{
    visitId: ID;
    currentDate: string;
    officeName: string;
  } | null>(null);
  const [newVisitDate, setNewVisitDate] = useState<string>('');

  const { data: clientsRes } = useClients();
  const clients = clientsRes?.items || [];

  const updateVisitMutation = useUpdateVisit();
  const changeTaskDueMutation = useChangeTaskDue();

  // Compute the query interval based on view & currentDate
  const { fromStr, toStr, daysToRender } = useMemo(() => {
    if (view === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const start = startOfWeek(monthStart, { weekStartsOn });
      const end = endOfWeek(monthEnd, { weekStartsOn });
      const days = eachDayOfInterval({ start, end });
      return {
        fromStr: format(start, 'yyyy-MM-dd'),
        toStr: format(end, 'yyyy-MM-dd'),
        daysToRender: days,
      };
    } else if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn });
      const end = endOfWeek(currentDate, { weekStartsOn });
      const days = eachDayOfInterval({ start, end });
      return {
        fromStr: format(start, 'yyyy-MM-dd'),
        toStr: format(end, 'yyyy-MM-dd'),
        daysToRender: days,
      };
    } else {
      // Agenda: from today to +30 days
      const start = currentDate;
      const end = addWeeks(currentDate, 4);
      const days = eachDayOfInterval({ start, end });
      return {
        fromStr: format(start, 'yyyy-MM-dd'),
        toStr: format(end, 'yyyy-MM-dd'),
        daysToRender: days,
      };
    }
  }, [currentDate, view, weekStartsOn]);

  const { data: rawItems = [], isLoading } = useCalendar(fromStr, toStr);

  // Filtered calendar items
  const calendarItems = useMemo(() => {
    return rawItems.filter((item) => {
      if (itemTypeFilter !== 'all' && item.type !== itemTypeFilter) {
        return false;
      }
      if (selectedClientId && item.clientId !== selectedClientId) {
        return false;
      }
      return true;
    });
  }, [rawItems, itemTypeFilter, selectedClientId]);

  // Group items by date: Record<YYYY-MM-DD, CalendarItem[]>
  const itemsByDate = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    for (const item of calendarItems) {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    }
    return map;
  }, [calendarItems]);

  // Navigation handlers
  const handlePrev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subWeeks(currentDate, 2));
  };

  const handleNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addWeeks(currentDate, 2));
  };

  const handleToday = () => {
    setCurrentDate(todayDate);
  };

  // Drag-and-drop or move handlers
  const handleMoveVisit = async (visitId: ID, targetDate: string, prevDate: string) => {
    try {
      await updateVisitMutation.mutateAsync({
        id: visitId,
        updates: { plannedDate: targetDate },
      });
      toast.success(`Visit rescheduled to ${formatDate(targetDate)}`, {
        action: {
          label: 'Undo',
          onClick: () => {
            updateVisitMutation.mutate({
              id: visitId,
              updates: { plannedDate: prevDate },
            });
          },
        },
      });
      setVisitToReschedule(null);
    } catch (err: any) {
      toast.error('Failed to move visit date');
    }
  };

  const handleConfirmTaskReschedule = async () => {
    if (!taskToReschedule || !newTaskDueDate) return;
    if (!rescheduleReason.trim()) {
      toast.error('Reason is required when moving a task due date');
      return;
    }
    try {
      await changeTaskDueMutation.mutateAsync({
        id: taskToReschedule.taskId,
        dueDate: newTaskDueDate,
        ref: rescheduleSourceRef.trim(),
        reason: rescheduleReason.trim(),
      });
      toast.success(`Task deadline moved to ${formatDate(newTaskDueDate)}`);
      setTaskToReschedule(null);
    } catch (err: any) {
      toast.error('Failed to change task due date');
    }
  };

  const viewTitle = useMemo(() => {
    if (view === 'month') return format(currentDate, 'MMMM yyyy');
    if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn });
      const end = endOfWeek(currentDate, { weekStartsOn });
      return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
    }
    return `Agenda: from ${format(currentDate, 'MMM d, yyyy')}`;
  }, [currentDate, view, weekStartsOn]);

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const orderedWeekdays = [
    ...weekdays.slice(weekStartsOn),
    ...weekdays.slice(0, weekStartsOn),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">
            Tax Calendar
          </h1>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Filing deadlines, scheduled office visits, statutory holidays, and SPA expiries
          </p>
        </div>

        {/* View Switcher: Month / Week / Agenda */}
        <div className="flex items-center gap-1 bg-sheet-2 p-1 rounded-control border border-rule self-start sm:self-auto">
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1 text-xs font-semibold rounded-control transition-colors cursor-pointer ${
              view === 'month'
                ? 'bg-sheet text-ink font-bold shadow-2xs'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1 text-xs font-semibold rounded-control transition-colors cursor-pointer ${
              view === 'week'
                ? 'bg-sheet text-ink font-bold shadow-2xs'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setView('agenda')}
            className={`px-3 py-1 text-xs font-semibold rounded-control transition-colors cursor-pointer ${
              view === 'agenda'
                ? 'bg-sheet text-ink font-bold shadow-2xs'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            Agenda
          </button>
        </div>
      </div>

      {/* Navigation Toolbar & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-sheet border border-rule rounded-panel p-3 shadow-xs">
        {/* Navigation Buttons & Month Title */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-bold rounded-control bg-sheet-2 border border-rule text-ink hover:bg-sheet-3 shadow-xs cursor-pointer"
          >
            Today
          </button>

          <div className="flex items-center border border-rule rounded-control overflow-hidden bg-sheet-2">
            <button
              onClick={handlePrev}
              className="p-1.5 text-ink-3 hover:text-ink hover:bg-sheet-3 transition-colors cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 text-ink-3 hover:text-ink hover:bg-sheet-3 transition-colors cursor-pointer"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-base font-extrabold text-ink font-sans ml-2">
            {viewTitle}
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Client Filter */}
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="bg-sheet-2 border border-rule rounded-control px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-stamp"
          >
            <option value="">All Clients</option>
            {clients.map(({ client }) => (
              <option key={client.id} value={client.id}>
                [{client.code}] {client.displayName}
              </option>
            ))}
          </select>

          {/* Item Type Filter */}
          <select
            value={itemTypeFilter}
            onChange={(e) => setItemTypeFilter(e.target.value as ItemTypeFilter)}
            className="bg-sheet-2 border border-rule rounded-control px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-stamp"
          >
            <option value="all">All Item Types</option>
            <option value="task_due">Task Due Dates</option>
            <option value="visit">Office Visits</option>
            <option value="holiday">Statutory Holidays</option>
            <option value="follow_up">Follow-ups Expected</option>
            <option value="authorization_expiry">SPA Expiries</option>
          </select>
        </div>
      </div>

      {/* Main Calendar Display */}
      {view === 'month' && (
        <div className="bg-sheet border border-rule rounded-panel overflow-hidden shadow-xs">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 border-b border-rule bg-sheet-2 text-center text-[11px] font-bold text-ink-3 uppercase py-2">
            {orderedWeekdays.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-rule">
            {daysToRender.map((dayDate) => {
              const dateStr = format(dayDate, 'yyyy-MM-dd');
              const isCurrentMonth = isSameMonth(dayDate, currentDate);
              const isToday = dateStr === todayStr;
              const itemsForDay = itemsByDate[dateStr] || [];

              // Holiday label under date number
              const holidayItem = itemsForDay.find((i) => i.type === 'holiday');
              const nonHolidayItems = itemsForDay.filter((i) => i.type !== 'holiday');

              // Max 3 chips to show inline
              const displayedItems = nonHolidayItems.slice(0, 3);
              const remainingCount = nonHolidayItems.length - 3;

              return (
                <div
                  key={dateStr}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dragData = e.dataTransfer.getData('application/json');
                    if (!dragData) return;
                    try {
                      const payload = JSON.parse(dragData);
                      if (payload.type === 'visit') {
                        handleMoveVisit(payload.id, dateStr, payload.prevDate);
                      } else if (payload.type === 'task') {
                        setTaskToReschedule({
                          taskId: payload.id,
                          currentDue: payload.prevDate,
                          taskTitle: payload.title,
                        });
                        setNewTaskDueDate(dateStr);
                      }
                    } catch (err) {}
                  }}
                  className={`min-h-[110px] sm:min-h-[125px] p-2 flex flex-col justify-between transition-colors ${
                    isCurrentMonth ? 'bg-sheet' : 'bg-sheet-2/40 text-ink-3'
                  } ${isToday ? 'ring-1 ring-stamp/40 bg-stamp-soft/10' : ''}`}
                >
                  {/* Top Day Header */}
                  <div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-mono font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                          isToday
                            ? 'bg-stamp text-on-stamp font-black shadow-xs'
                            : isCurrentMonth
                            ? 'text-ink'
                            : 'text-ink-3'
                        }`}
                      >
                        {format(dayDate, 'd')}
                      </span>

                      {/* Remaining badge */}
                      {remainingCount > 0 && (
                        <button
                          onClick={() =>
                            setSelectedDayItems({
                              dateStr,
                              items: itemsForDay,
                            })
                          }
                          className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-sheet-2 hover:bg-sheet-3 text-ink-2 border border-rule cursor-pointer"
                        >
                          +{remainingCount} more
                        </button>
                      )}
                    </div>

                    {/* Holiday label under date number per Spec 11.10 */}
                    {holidayItem && (
                      <div
                        className="text-[10px] text-ink-3 font-semibold truncate mt-0.5"
                        title={holidayItem.title}
                      >
                        {holidayItem.title}
                      </div>
                    )}
                  </div>

                  {/* Day Chips (Max 3) */}
                  <div className="space-y-1 mt-1.5 flex-1">
                    {displayedItems.map((item) => {
                      if (item.type === 'task_due') {
                        const isBlocked = (item.meta as any)?.isBlocked;
                        const dueState = (item.meta as any)?.dueState;
                        const isCritical = dueState === 'overdue';

                        return (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                'application/json',
                                JSON.stringify({
                                  type: 'task',
                                  id: item.id,
                                  prevDate: item.date,
                                  title: item.title,
                                })
                              );
                            }}
                            onClick={() => navigate(`/tasks/${item.id}`)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border flex items-center justify-between gap-1 cursor-grab active:cursor-grabbing truncate transition-all ${
                              isCritical
                                ? 'bg-critical-bg text-critical-fg border-critical-bd'
                                : 'bg-sheet-2 text-ink border-rule hover:border-stamp'
                            }`}
                            title={`${item.title} (Click to open, drag to change due date)`}
                          >
                            <span className="truncate">{item.title}</span>
                            {isBlocked && (
                              <Lock className="w-2.5 h-2.5 text-critical-fg shrink-0" />
                            )}
                          </div>
                        );
                      }

                      if (item.type === 'visit') {
                        const meta = item.meta as any;
                        const isReady = meta?.isReady;

                        return (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                'application/json',
                                JSON.stringify({
                                  type: 'visit',
                                  id: item.id,
                                  prevDate: item.date,
                                  officeName: meta?.officeName,
                                })
                              );
                            }}
                            onClick={() => navigate(`/visits/${item.id}`)}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-stamp-soft text-stamp border border-stamp/30 flex items-center gap-1 cursor-grab active:cursor-grabbing truncate"
                            title={`${item.title} · ${isReady ? 'READY' : 'Not ready'} (Drag to reschedule)`}
                          >
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{meta?.officeName || item.title}</span>
                          </div>
                        );
                      }

                      if (item.type === 'follow_up') {
                        return (
                          <div
                            key={item.id}
                            onClick={() => navigate('/follow-ups')}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sheet-2 text-ink-2 border border-rule flex items-center gap-1 cursor-pointer truncate"
                            title={item.title}
                          >
                            <MessageCircleMore className="w-2.5 h-2.5 text-ink-3 shrink-0" />
                            <span className="truncate">{item.title}</span>
                          </div>
                        );
                      }

                      if (item.type === 'authorization_expiry') {
                        return (
                          <div
                            key={item.id}
                            onClick={() => item.clientId && navigate(`/clients/${item.clientId}`)}
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-warn-bg text-warn-fg border border-warn-bd flex items-center gap-1 cursor-pointer truncate"
                            title={item.title}
                          >
                            <Hourglass className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{item.title}</span>
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View */}
      {view === 'week' && (
        <div className="bg-sheet border border-rule rounded-panel overflow-hidden shadow-xs">
          <div className="grid grid-cols-7 border-b border-rule bg-sheet-2 text-center text-xs font-bold text-ink py-2">
            {daysToRender.map((d) => (
              <div key={d.toISOString()} className="space-y-0.5">
                <span className="text-[10px] uppercase text-ink-3 block">
                  {format(d, 'EEE')}
                </span>
                <span
                  className={`inline-block font-mono font-bold px-2 py-0.5 rounded-full ${
                    format(d, 'yyyy-MM-dd') === todayStr
                      ? 'bg-stamp text-on-stamp'
                      : 'text-ink'
                  }`}
                >
                  {format(d, 'd')}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-rule min-h-[350px]">
            {daysToRender.map((d) => {
              const dateStr = format(d, 'yyyy-MM-dd');
              const itemsForDay = itemsByDate[dateStr] || [];

              return (
                <div key={dateStr} className="p-2 space-y-2 bg-sheet">
                  {itemsForDay.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.type === 'task_due') navigate(`/tasks/${item.id}`);
                        else if (item.type === 'visit') navigate(`/visits/${item.id}`);
                        else if (item.type === 'follow_up') navigate('/follow-ups');
                        else if (item.clientId) navigate(`/clients/${item.clientId}`);
                      }}
                      className="p-2 rounded-control bg-sheet-2 border border-rule text-xs space-y-1 hover:border-stamp transition-all cursor-pointer shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-ink-3 font-mono">
                          {item.type.replace(/_/g, ' ')}
                        </span>
                        {(item.meta as any)?.isBlocked && (
                          <Lock className="w-3 h-3 text-critical-fg" />
                        )}
                      </div>
                      <p className="font-bold text-ink leading-tight">{item.title}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agenda View (Default on phone) */}
      {view === 'agenda' && (
        <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs">
          {daysToRender.map((dayDate) => {
            const dateStr = format(dayDate, 'yyyy-MM-dd');
            const itemsForDay = itemsByDate[dateStr] || [];
            if (itemsForDay.length === 0) return null;

            const isToday = dateStr === todayStr;

            return (
              <div key={dateStr} className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-28 shrink-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-ink">{format(dayDate, 'MMM d')}</span>
                    {isToday && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-stamp text-on-stamp uppercase">
                        Today
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-ink-3 uppercase font-semibold">
                    {format(dayDate, 'EEEE')}
                  </span>
                </div>

                <div className="flex-1 space-y-2 w-full">
                  {itemsForDay.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.type === 'task_due') navigate(`/tasks/${item.id}`);
                        else if (item.type === 'visit') navigate(`/visits/${item.id}`);
                        else if (item.type === 'follow_up') navigate('/follow-ups');
                        else if (item.clientId) navigate(`/clients/${item.clientId}`);
                      }}
                      className="p-3 rounded-control bg-sheet-2 border border-rule flex items-center justify-between hover:bg-sheet-3 transition-colors cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        {item.type === 'task_due' && <CalendarIcon className="w-4 h-4 text-ink-2" />}
                        {item.type === 'visit' && <MapPin className="w-4 h-4 text-stamp" />}
                        {item.type === 'holiday' && <Info className="w-4 h-4 text-ink-3" />}
                        {item.type === 'follow_up' && <MessageCircleMore className="w-4 h-4 text-ink-2" />}
                        {item.type === 'authorization_expiry' && <Hourglass className="w-4 h-4 text-warn-fg" />}
                        <span className="font-bold text-ink">{item.title}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-ink-3 capitalize">
                          {item.type.replace(/_/g, ' ')}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-ink-3" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Day Details Popover / Modal (When +N more is clicked) */}
      {selectedDayItems && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-paper border border-rule rounded-panel shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <div>
                <h3 className="text-base font-bold text-ink font-sans">
                  {formatDate(selectedDayItems.dateStr)}
                </h3>
                <span className="text-xs text-ink-3">
                  {selectedDayItems.items.length} scheduled items
                </span>
              </div>
              <button
                onClick={() => setSelectedDayItems(null)}
                className="p-1 rounded text-ink-3 hover:text-ink cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {selectedDayItems.items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedDayItems(null);
                    if (item.type === 'task_due') navigate(`/tasks/${item.id}`);
                    else if (item.type === 'visit') navigate(`/visits/${item.id}`);
                    else if (item.type === 'follow_up') navigate('/follow-ups');
                    else if (item.clientId) navigate(`/clients/${item.clientId}`);
                  }}
                  className="p-3 rounded-control bg-sheet border border-rule flex items-center justify-between hover:bg-sheet-2 transition-colors cursor-pointer text-xs"
                >
                  <span className="font-bold text-ink">{item.title}</span>
                  <span className="text-[11px] text-ink-3 capitalize">
                    {item.type.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Task Due Date Dialog */}
      {taskToReschedule && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-paper border border-rule rounded-panel shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-stamp" />
                <h3 className="text-base font-bold text-ink font-sans">
                  Change Statutory Due Date
                </h3>
              </div>
              <button
                onClick={() => setTaskToReschedule(null)}
                className="p-1 rounded text-ink-3 hover:text-ink cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-ink-2">
                Rescheduling due date for <strong>{taskToReschedule.taskTitle}</strong> from{' '}
                <span className="line-through">{formatDate(taskToReschedule.currentDue)}</span> to{' '}
                <strong className="text-stamp">{formatDate(newTaskDueDate)}</strong>.
              </p>

              <div className="space-y-1">
                <label className="font-bold text-ink">Statutory Source Reference (Required)</label>
                <input
                  type="text"
                  value={rescheduleSourceRef}
                  onChange={(e) => setRescheduleSourceRef(e.target.value)}
                  placeholder="e.g. BIR RMC No. 45-2026 / Bank Holiday Extension"
                  className="w-full bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-stamp"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink">Reason for Deadline Change (Required)</label>
                <textarea
                  rows={2}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Due date falls on a local city non-working holiday; shifted to next banking day..."
                  className="w-full bg-sheet border border-rule rounded-control p-2 text-xs text-ink focus:outline-none focus:border-stamp"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-rule">
              <button
                type="button"
                onClick={() => setTaskToReschedule(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-control bg-sheet border border-rule text-ink hover:bg-sheet-2 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTaskReschedule}
                className="px-4 py-1.5 text-xs font-bold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong shadow-xs cursor-pointer"
              >
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
