import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  Users,
  CheckSquare,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { useClients, useTemplates, useTasks, useOpenPeriod } from '@/hooks/useData';

interface OpenPeriodModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3;

export function OpenPeriodModal({ open, onClose }: OpenPeriodModalProps) {
  const { data: clientsData } = useClients({ status: 'active' });
  const { data: templates = [] } = useTemplates({ active: true });
  const { data: existingTasksData } = useTasks();
  const openPeriodMutation = useOpenPeriod();

  const [step, setStep] = useState<Step>(1);
  const [period, setPeriod] = useState<string>('2026-10');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [taskSelections, setTaskSelections] = useState<
    Array<{ clientId: string; templateId: string; dueDate: string; selected: boolean }>
  >([]);
  const [commitSummary, setCommitSummary] = useState<{ created: number; lines: number } | null>(null);

  const clients = clientsData?.items || [];
  const existingTasks = existingTasksData?.items || [];

  // Initialize selected clients on open
  React.useEffect(() => {
    if (clients.length > 0 && selectedClientIds.length === 0) {
      setSelectedClientIds(clients.map((c) => c.client.id));
    }
  }, [clients]);


  const toggleClient = (id: string) => {
    if (selectedClientIds.includes(id)) {
      setSelectedClientIds(selectedClientIds.filter((cid) => cid !== id));
    } else {
      setSelectedClientIds([...selectedClientIds, id]);
    }
  };

  const selectAllClients = () => {
    if (selectedClientIds.length === clients.length) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(clients.map((c) => c.client.id));
    }
  };

  // Build client x template matrix when moving to Step 3
  const handleProceedToReview = () => {
    const matrix: Array<{
      clientId: string;
      templateId: string;
      dueDate: string;
      selected: boolean;
    }> = [];

    const now = new Date();
    const defaultDue = new Date(now.getFullYear(), now.getMonth() + 1, 20)
      .toISOString()
      .slice(0, 10);

    for (const cid of selectedClientIds) {
      const cl = clients.find((c) => c.client.id === cid)?.client;
      if (!cl) continue;

      for (const tmpl of templates) {
        // Check if already open
        const alreadyOpen = existingTasks.some(
          (t) =>
            t.task.clientId === cid &&
            t.task.templateId === tmpl.id &&
            t.task.period === period
        );

        // Pre-tick if not already open and template applies
        const applies =
          !alreadyOpen &&
          (tmpl.appliesTo?.entityTypes ? tmpl.appliesTo.entityTypes.includes(cl.entityType) : true);

        matrix.push({
          clientId: cid,
          templateId: tmpl.id,
          dueDate: defaultDue,
          selected: applies,
        });
      }
    }

    setTaskSelections(matrix);
    setStep(3);
  };

  const toggleTaskSelection = (clientId: string, templateId: string) => {
    setTaskSelections((prev) =>
      prev.map((item) =>
        item.clientId === clientId && item.templateId === templateId
          ? { ...item, selected: !item.selected }
          : item
      )
    );
  };

  const selectedCount = taskSelections.filter((t) => t.selected).length;

  const handleCommit = () => {
    const activeToCreate = taskSelections.filter((t) => t.selected);
    openPeriodMutation.mutate(
      {
        period,
        selections: activeToCreate.map((s) => ({
          clientId: s.clientId,
          templateId: s.templateId,
          dueDate: s.dueDate,
        })),
      },
      {
        onSuccess: (res) => {
          setCommitSummary({ created: res.created.length, lines: res.lines });
        },
      }
    );
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      maxWidth="max-w-3xl"
      ariaLabel="Open Filing Period Wizard"
      panelClassName="flex flex-col max-h-[90vh]"
    >
        {/* Header */}
        <div className="p-4 border-b border-rule flex items-center justify-between shrink-0 bg-sheet">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-stamp-soft text-stamp flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Open Filing Period Wizard</h3>
              <p className="text-[11px] text-ink-3">Batch generate recurring returns and checklists across active clients</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wizard Step Bar */}
        <div className="grid grid-cols-3 border-b border-rule bg-sheet-2/40 text-xs text-center font-bold">
          <div className={`p-2.5 border-r border-rule ${step === 1 ? 'text-stamp bg-sheet border-b-2 border-b-stamp' : 'text-ink-3'}`}>
            1. Period Selection
          </div>
          <div className={`p-2.5 border-r border-rule ${step === 2 ? 'text-stamp bg-sheet border-b-2 border-b-stamp' : 'text-ink-3'}`}>
            2. Client Scope ({selectedClientIds.length})
          </div>
          <div className={`p-2.5 ${step === 3 ? 'text-stamp bg-sheet border-b-2 border-b-stamp' : 'text-ink-3'}`}>
            3. Template Matrix &amp; Due Dates
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {commitSummary ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-good-bg text-good-fg mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-ink font-sans">
                Filing Period {period} Opened Successfully
              </h3>
              <p className="text-xs text-ink-3">
                {commitSummary.created} returns and {commitSummary.lines} checklist requirement lines have been generated.
              </p>
              <Button variant="primary" size="sm" onClick={onClose}>
                View Active Tasks
              </Button>
            </div>
          ) : (
            <>
              {/* STEP 1: PERIOD */}
              {step === 1 && (
                <div className="space-y-4 max-w-md mx-auto py-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-ink">Target Filing Period Key</label>
                    <p className="text-[11px] text-ink-3">Enter month (YYYY-MM), quarter (YYYY-QX), or annual year (YYYY)</p>
                  </div>

                  <input
                    type="text"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    placeholder="e.g. 2026-10 or 2026-Q3"
                    className="w-full p-3 text-base font-mono font-bold bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
                  />

                  <div className="flex flex-wrap gap-2 pt-2">
                    {['2026-10', '2026-Q3', '2026-09', '2026'].map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`px-3 py-1 text-xs rounded-control font-mono font-bold border ${
                          period === p ? 'bg-stamp text-on-stamp border-stamp' : 'bg-sheet border-rule text-ink hover:bg-sheet-2'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 2: CLIENT SCOPE */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-rule pb-2">
                    <span className="text-xs font-bold text-ink">
                      Active Taxpayers ({clients.length})
                    </span>
                    <button
                      type="button"
                      onClick={selectAllClients}
                      className="text-xs font-bold text-stamp hover:underline"
                    >
                      {selectedClientIds.length === clients.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {clients.map(({ client }) => {
                      const isChecked = selectedClientIds.includes(client.id);
                      return (
                        <label
                          key={client.id}
                          className={`p-3 rounded-control border flex items-center justify-between cursor-pointer transition-colors ${
                            isChecked ? 'bg-sheet border-stamp/40 shadow-2xs' : 'bg-sheet-2 border-rule opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleClient(client.id)}
                              className="rounded text-stamp focus:ring-stamp"
                            />
                            <div>
                              <span className="font-mono font-bold text-xs text-stamp mr-1.5">[{client.code}]</span>
                              <span className="text-xs font-bold text-ink">{client.displayName}</span>
                            </div>
                          </div>
                          <span className="text-[10px] text-ink-3 uppercase">{client.entityType}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 3: MATRIX & DUE DATES */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-rule pb-2">
                    <div>
                      <span className="text-xs font-bold text-ink">
                        Review Client × Template Matrix
                      </span>
                      <p className="text-[11px] text-ink-3">Pre-ticked matching taxpayer entity type and frequency</p>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-stamp-soft text-stamp border border-stamp/20">
                      {selectedCount} Tasks to Create
                    </span>
                  </div>

                  <div className="border border-rule rounded-control overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-sheet-2 border-b border-rule text-ink font-bold">
                        <tr>
                          <th className="p-2.5">Client</th>
                          {templates.map((t) => (
                            <th key={t.id} className="p-2.5 text-center whitespace-nowrap">
                              <span className="font-mono text-stamp">{t.code}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rule font-sans">
                        {selectedClientIds.map((cid) => {
                          const cl = clients.find((c) => c.client.id === cid)?.client;
                          if (!cl) return null;
                          return (
                            <tr key={cl.id} className="hover:bg-sheet-2">
                              <td className="p-2.5 font-bold text-ink whitespace-nowrap">
                                [{cl.code}] {cl.displayName}
                              </td>
                              {templates.map((tmpl) => {
                                const alreadyOpen = existingTasks.some(
                                  (t) =>
                                    t.task.clientId === cid &&
                                    t.task.templateId === tmpl.id &&
                                    t.task.period === period
                                );
                                const current = taskSelections.find(
                                  (item) => item.clientId === cid && item.templateId === tmpl.id
                                );
                                return (
                                  <td key={tmpl.id} className="p-2.5 text-center">
                                    {alreadyOpen ? (
                                      <span className="text-[10px] text-ink-3 font-semibold">Open</span>
                                    ) : (
                                      <input
                                        type="checkbox"
                                        checked={Boolean(current?.selected)}
                                        onChange={() => toggleTaskSelection(cid, tmpl.id)}
                                        className="rounded text-stamp focus:ring-stamp cursor-pointer"
                                      />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!commitSummary && (
          <div className="p-4 border-t border-rule bg-sheet-2/60 flex items-center justify-between shrink-0">
            {step > 1 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep((step - 1) as Step)}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                <span>Back</span>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
            )}

            {step === 1 && (
              <Button variant="primary" size="sm" onClick={() => setStep(2)}>
                <span>Next: Choose Clients</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}

            {step === 2 && (
              <Button
                variant="primary"
                size="sm"
                disabled={selectedClientIds.length === 0}
                onClick={handleProceedToReview}
              >
                <span>Next: Review Matrix</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}

            {step === 3 && (
              <Button
                variant="primary"
                size="sm"
                disabled={selectedCount === 0}
                onClick={handleCommit}
                loading={openPeriodMutation.isPending}
              >
                <span>Create {selectedCount} Tasks</span>
              </Button>
            )}
          </div>
        )}
    </ModalDialog>
  );
}
