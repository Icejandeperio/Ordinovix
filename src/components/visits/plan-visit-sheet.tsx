import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Office, TaskSummary, VisitAction } from '@/domain/types';
import { useOffices, useMemberships, useTasks, useCreateVisit, useSession } from '@/hooks/useData';
import { DateField } from '@/components/inputs/date-field';
import { nonWorkingDayNote } from '@/domain/rules';
import { todayInManila } from '@/lib/dates';
import { OfficeFormModal } from '@/components/offices/office-form-modal';
import {
  X,
  Plus,
  MapPin,
  Calendar,
  Clock,
  User,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { SlideSheet } from '@/components/ui/slide-sheet';

interface PlanVisitSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PlanVisitSheet({ isOpen, onClose }: PlanVisitSheetProps) {
  const navigate = useNavigate();
  const { data: offices = [] } = useOffices();
  const { data: memberships = [] } = useMemberships();
  const { data: session } = useSession();
  const { data: tasksRes } = useTasks();
  const allTasks = tasksRes?.items || [];
  const createVisitMutation = useCreateVisit();

  const [selectedOfficeId, setSelectedOfficeId] = useState<string>(offices[0]?.id || '');
  const [plannedDate, setPlannedDate] = useState<string>(todayInManila());
  const [arriveBy, setArriveBy] = useState<string>('08:30');
  const [assigneeUserId, setAssigneeUserId] = useState<string>(
    memberships[0]?.userId || ''
  );
  const [purpose, setPurpose] = useState<string>('');

  // Selected tasks for the visit with intended action
  const [selectedTasks, setSelectedTasks] = useState<
    Array<{ taskId: string; action: VisitAction }>
  >([]);

  const [isAddOfficeOpen, setIsAddOfficeOpen] = useState(false);

  const selectedOffice = useMemo(() => {
    return offices.find((o) => o.id === selectedOfficeId) || offices[0];
  }, [offices, selectedOfficeId]);

  // Weekend & holiday warning
  const dayWarning = useMemo(() => {
    if (!plannedDate) return null;
    return nonWorkingDayNote(plannedDate, []);
  }, [plannedDate]);

  // Candidate tasks that need office action or are relevant to this office/RDO
  const candidateTasks = useMemo(() => {
    return allTasks.filter(
      (t) =>
        t.task.status !== 'completed' &&
        t.task.status !== 'archived' &&
        t.task.officeAction
    );
  }, [allTasks]);


  const handleToggleTask = (taskId: string) => {
    const exists = selectedTasks.find((t) => t.taskId === taskId);
    if (exists) {
      setSelectedTasks(selectedTasks.filter((t) => t.taskId !== taskId));
    } else {
      setSelectedTasks([...selectedTasks, { taskId, action: 'submit' }]);
    }
  };

  const handleSetAction = (taskId: string, action: VisitAction) => {
    setSelectedTasks(
      selectedTasks.map((t) => (t.taskId === taskId ? { ...t, action } : t))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffice) {
      toast.error('Please select an office');
      return;
    }
    if (selectedTasks.length === 0) {
      toast.error('Select at least one task for this office trip');
      return;
    }

    try {
      const newVisit = await createVisitMutation.mutateAsync({
        visit: {
          officeId: selectedOffice.id,
          officeType: selectedOffice.type,
          officeName: selectedOffice.name,
          rdoCode: selectedOffice.rdoCode,
          plannedDate,
          arriveBy: arriveBy || undefined,
          // A helper cannot list memberships, so fall back to the signed-in user rather than someone else
          assigneeUserId: assigneeUserId || session?.user.id || '',
          purpose: purpose.trim() || undefined,
        },
        items: selectedTasks,
      });

      toast.success('Trip planned successfully');
      onClose();
      navigate(`/visits/${newVisit.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to plan visit');
    }
  };

  return (
    <SlideSheet
      open={isOpen}
      onClose={onClose}
      maxWidth="max-w-xl"
      ariaLabel="Plan Office Trip"
    >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-rule bg-sheet flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-stamp" />
            <h2 className="text-base sm:text-lg font-bold text-ink">Plan Office Trip</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-control text-ink-3 hover:text-ink hover:bg-sheet-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
          {/* Office Picker */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-bold text-ink">Destination Office (Required)</label>
              <button
                type="button"
                onClick={() => setIsAddOfficeOpen(true)}
                className="text-stamp font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add office
              </button>
            </div>
            <select
              required
              value={selectedOfficeId}
              onChange={(e) => setSelectedOfficeId(e.target.value)}
              className="w-full bg-sheet border border-rule rounded-control px-2.5 py-2 text-ink font-sans focus:outline-none focus:border-stamp"
            >
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.rdoCode ? `(RDO ${o.rdoCode})` : ''} — {o.type.toUpperCase()}
                </option>
              ))}
            </select>
            {selectedOffice?.tips && (
              <p className="text-[11px] text-stamp font-medium mt-1">
                Tip: {selectedOffice.tips}
              </p>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-ink">Trip Date (Required)</label>
              <DateField value={plannedDate} onChange={(val) => setPlannedDate(val || '')} />
              {dayWarning && (
                <div className="p-2 rounded-control bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-400 text-[11px] flex items-center gap-1.5 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{dayWarning}</span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="font-bold text-ink">Target Arrival Time</label>
              <input
                type="time"
                value={arriveBy}
                onChange={(e) => setArriveBy(e.target.value)}
                className="w-full bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:border-stamp"
              />
            </div>
          </div>

          {/* Assignee & Purpose */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-ink">Assignee / Messenger</label>
              <select
                value={assigneeUserId}
                onChange={(e) => setAssigneeUserId(e.target.value)}
                className="w-full bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:border-stamp"
              >
                {memberships.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.email} ({m.role.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-ink">Trip Purpose (Optional)</label>
              <input
                type="text"
                maxLength={200}
                placeholder="e.g. Morning ONETT submission & stamping"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:border-stamp"
              />
            </div>
          </div>

          {/* Task Picker Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-ink">Select Tasks for this Trip</label>
              <span className="text-[11px] text-ink-3">
                {selectedTasks.length} selected
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto bg-sheet p-3 rounded-panel border border-rule">
              {candidateTasks.map((t) => {
                const isSelected = selectedTasks.some((st) => st.taskId === t.task.id);
                const currentAction =
                  selectedTasks.find((st) => st.taskId === t.task.id)?.action || 'submit';

                return (
                  <div
                    key={t.task.id}
                    className={`p-2.5 rounded-control border transition-colors ${
                      isSelected
                        ? 'border-stamp/40 bg-stamp-soft/20'
                        : 'border-rule bg-paper hover:bg-sheet-2'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleTask(t.task.id)}
                        className="mt-1 rounded text-stamp focus:ring-stamp"
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-stamp-soft text-stamp">
                            {t.client.code}
                          </span>
                          <span className="font-bold text-ink">{t.task.title}</span>
                          <span className="text-[10px] text-ink-3">
                            Due {t.task.dueDate}
                          </span>
                        </div>

                        {isSelected && (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[11px] text-ink-2">Action:</span>
                            <select
                              value={currentAction}
                              onChange={(e) =>
                                handleSetAction(t.task.id, e.target.value as VisitAction)
                              }
                              className="bg-paper border border-rule rounded px-2 py-0.5 text-[11px] text-ink font-semibold"
                            >
                              <option value="submit">Submit Filing / Form</option>
                              <option value="pay">Pay Taxes OTC</option>
                              <option value="claim">Claim Stamped / eCAR</option>
                              <option value="inquire">Inquire / Consult Officer</option>
                              <option value="follow_up">Follow Up Processing</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-rule">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 font-semibold text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createVisitMutation.isPending || selectedTasks.length === 0}
              className="px-5 py-2 font-bold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong shadow-xs disabled:opacity-50"
            >
              {createVisitMutation.isPending ? 'Planning…' : 'Create Trip Plan'}
            </button>
          </div>
        </form>

        {isAddOfficeOpen && (
          <OfficeFormModal
            isOpen={isAddOfficeOpen}
            onClose={() => setIsAddOfficeOpen(false)}
            onSuccess={(saved) => setSelectedOfficeId(saved.id)}
          />
        )}
    </SlideSheet>
  );
}
