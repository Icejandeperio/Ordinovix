import React from 'react';
import { useCalendar } from '@/hooks/useData';
import { todayInManila, addDaysToDate, formatDate } from '@/lib/dates';
import { Calendar as CalendarIcon, Clock, MapPin, AlertCircle } from 'lucide-react';

export function CalendarPage() {
  const today = todayInManila();
  const from = addDaysToDate(today, -7);
  const to = addDaysToDate(today, 30);
  const { data: items = [], isLoading } = useCalendar(from, to);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">Calendar</h1>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Filing deadlines, planned office visits, and Philippine statutory holidays
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 bg-sheet-3 rounded-panel animate-pulse" />
      ) : (
        <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs">
          {items.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-sheet-2 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-control bg-sheet-2 border border-rule flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold text-stamp uppercase leading-none">
                    {item.date.slice(5, 7)}
                  </span>
                  <span className="text-sm font-black text-ink leading-tight">
                    {item.date.slice(8, 10)}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">{item.title}</h3>
                  <span className="text-xs text-ink-3 capitalize">{item.type.replace(/_/g, ' ')}</span>
                </div>
              </div>

              <span className="text-xs font-semibold text-ink-2">{formatDate(item.date)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
