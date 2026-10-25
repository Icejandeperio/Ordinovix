import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useVisit, useOrgSettings } from '@/hooks/useData';
import { formatDate } from '@/lib/format';
import { maskTin } from '@/lib/format';
import { ArrowLeft, Printer } from 'lucide-react';

export function VisitPrintPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const { data, isLoading } = useVisit(visitId || '');
  const { data: orgSettings } = useOrgSettings();

  if (isLoading || !data) {
    return <div className="p-8 text-center text-xs text-ink-3">Loading trip pack for printing...</div>;
  }

  const { visit, items, packList: clientPacks, kitItems, office } = data;
  const paperSize = orgSettings?.paperSize || 'a4';

  const printedAt = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="bg-white text-black min-h-screen p-4 sm:p-8 font-sans antialiased">
      {/* Screen-only Action Bar */}
      <div className="no-print max-w-4xl mx-auto mb-6 flex items-center justify-between bg-sheet border border-rule rounded-panel p-4 shadow-xs">
        <Link
          to={`/visits/${visit.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Prepare</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-3">
            Paper size: <strong className="uppercase">{paperSize}</strong> (from Settings)
          </span>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-xs font-bold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Trip Pack</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet Container */}
      <div className="max-w-4xl mx-auto space-y-6 text-black">
        {/* Print Header */}
        <div className="border-b-2 border-black pb-4 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-600">
              Ordinovix · Counter Trip Pack
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-black mt-0.5">
              {visit.officeName}
            </h1>
            {office?.address && (
              <p className="text-[11pt] text-neutral-700">{office.address}</p>
            )}
            {office?.tips && (
              <p className="text-[10pt] text-neutral-800 italic mt-1">
                Tip: {office.tips}
              </p>
            )}
          </div>

          <div className="text-right text-[10pt] space-y-0.5">
            <div>
              <strong>Date:</strong> {formatDate(visit.plannedDate)}
            </div>
            {visit.arriveBy && (
              <div>
                <strong>Arrive by:</strong> {visit.arriveBy}
              </div>
            )}
            <div>
              <strong>Preparer:</strong> {visit.assigneeUserId === 'user-ana' ? 'Ana Santos' : 'Ben Morales'}
            </div>
            <div className="text-[9pt] text-neutral-600 font-mono">
              Trip #{visit.id.slice(0, 8)}
            </div>
          </div>
        </div>

        {/* Client-Grouped Blocks with Folder Tab Outlines */}
        <div className="space-y-6">
          {items.map(({ item, task, client, lines }, idx) => {
            const clientPack = clientPacks.find((cp) => cp.clientId === client.id);
            const physicalLines = clientPack?.items || [];
            const maskedClientTin = maskTin(client.tinFull || client.tinMasked || '123456789000');

            return (
              <div
                key={item.id}
                className="avoid-break border-2 border-black rounded-sm p-4 relative pt-6 mt-4"
              >
                {/* Folder Tab Outline Header */}
                <div className="absolute -top-3.5 left-4 bg-white px-2 border border-black font-mono font-bold text-[10pt] uppercase">
                  Folder Tab: [{client.code}] {client.displayName} · TIN: {maskedClientTin}
                </div>

                <div className="space-y-3">
                  {/* Task & Action Header */}
                  <div className="flex items-center justify-between border-b border-neutral-300 pb-2">
                    <div>
                      <span className="text-[9pt] font-bold uppercase text-neutral-600 block">
                        Errand Task #{idx + 1}
                      </span>
                      <h2 className="text-[12pt] font-black">{task.title || 'Tax filing errand'}</h2>
                    </div>
                    <div className="text-right">
                      <span className="inline-block border border-black px-2 py-0.5 text-[9pt] font-black uppercase">
                        Action: {item.intendedAction}
                      </span>
                    </div>
                  </div>

                  {/* Physical Documents to Submit Checklist */}
                  <div className="space-y-1.5">
                    <span className="text-[9pt] font-bold uppercase tracking-wider text-neutral-600 block">
                      Documents to Bring / Submit:
                    </span>
                    {physicalLines.length === 0 ? (
                      <p className="text-[10pt] text-neutral-600 italic">No physical papers to bring for this task.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-1.5 pl-1">
                        {physicalLines.map((p, pIdx) => (
                          <div key={pIdx} className="flex items-center gap-2.5 text-[10pt]">
                            {/* Drawn 4mm square checkbox per spec */}
                            <div className="w-4 h-4 border border-black rounded-[2px] shrink-0" />
                            <span className="font-semibold text-black">{p.label}</span>
                            <span className="text-neutral-600">
                              ({p.form.replace(/_/g, ' ')}, {p.copies} {p.copies === 1 ? 'copy' : 'copies'})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Authorization / SPA Details */}
                  <div className="text-[10pt] border-t border-neutral-200 pt-2 flex items-center justify-between">
                    <div>
                      <span className="font-bold">Authorization required: </span>
                      <span>
                        {task.officeAction
                          ? 'Valid SPA on file'
                          : 'Standard counter submission'}
                      </span>
                    </div>
                    {item.questions && (
                      <div className="text-right font-medium italic">
                        Questions: "{item.questions}"
                      </div>
                    )}
                  </div>

                  {/* Three Blank Ruled Lines for Counter Notes per spec */}
                  <div className="pt-2 space-y-2">
                    <span className="text-[9pt] font-bold uppercase tracking-wider text-neutral-600 block">
                      Counter Officer Notes / Window Remarks:
                    </span>
                    <div className="border-b border-neutral-400 h-5 w-full" />
                    <div className="border-b border-neutral-400 h-5 w-full" />
                    <div className="border-b border-neutral-400 h-5 w-full" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Visit Kit Items Checklist */}
        <div className="avoid-break border border-black p-4 space-y-2 mt-4 bg-neutral-50/50">
          <div className="flex items-center justify-between border-b border-neutral-300 pb-1">
            <h3 className="text-[10pt] font-black uppercase tracking-wider">
              Visit Kit — General Counter Supplies
            </h3>
            <span className="text-[9pt] text-neutral-600">Pack before departure</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[10pt]">
            {kitItems.map((k) => (
              <div key={k.kitItem.id} className="flex items-center gap-2">
                <div className="w-4 h-4 border border-black rounded-[2px] shrink-0" />
                <span className="font-semibold">{k.kitItem.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Printable Footer */}
        <div className="border-t border-black pt-3 flex items-center justify-between text-[9pt] text-neutral-600">
          <div>Ordinovix Private Practice Workflow</div>
          <div>Printed: {printedAt}</div>
          <div>Confidential Tax Document Pack</div>
        </div>
      </div>
    </div>
  );
}
