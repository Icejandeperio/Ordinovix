import React, { useState } from 'react';
import { devControls } from '@/data';
import { useTheme } from './theme';
import { Settings, RefreshCw, UserCheck, WifiOff, AlertTriangle, Calendar, Palette, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DateField } from '@/components/inputs/date-field';

export function DevMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const currentPersona = devControls.getPersona();
  const [offline, setOfflineState] = useState(devControls.getOffline());
  const [failureRate, setFailureRateState] = useState(devControls.getFailureRate());
  const [todayVal, setTodayVal] = useState(devControls.getToday() || '');

  const toggleOffline = () => {
    const next = !offline;
    setOfflineState(next);
    devControls.setOffline(next);
  };

  const handleFailureRateChange = (rate: number) => {
    setFailureRateState(rate);
    devControls.setFailureRate(rate);
  };

  const handlePersonaChange = (role: 'owner' | 'helper') => {
    devControls.setPersona(role);
  };

  const handleSetToday = (e: React.FormEvent) => {
    e.preventDefault();
    devControls.setToday(todayVal || null);
  };

  return (
    <>
      {/* Dev Menu Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-stamp text-on-stamp shadow-float hover:bg-stamp-strong transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stamp"
        title="Open Developer Menu"
      >
        <Settings className="w-3.5 h-3.5" />
        <span>Dev Menu</span>
        {currentPersona === 'helper' && <span className="px-1.5 py-0.5 rounded bg-amber-400 text-black text-[10px]">Helper</span>}
        {offline && <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px]">Offline</span>}
      </button>

      {/* Dev Menu Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-scrim backdrop-blur-xs">
          <div className="w-full max-w-md bg-sheet border border-rule rounded-overlay shadow-dialog p-6 space-y-5 text-ink animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-stamp" />
                <h2 className="text-lg font-bold">Ordinovix Dev Menu</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-control hover:bg-sheet-2 text-ink-3 hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Persona Switcher */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-2 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Simulated Persona</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handlePersonaChange('owner')}
                  className={`px-3 py-2 text-xs font-semibold rounded-control border transition-colors ${
                    currentPersona === 'owner'
                      ? 'bg-stamp text-on-stamp border-stamp'
                      : 'bg-sheet-2 text-ink border-rule hover:bg-sheet-3'
                  }`}
                >
                  Ana Santos (Owner)
                </button>
                <button
                  type="button"
                  onClick={() => handlePersonaChange('helper')}
                  className={`px-3 py-2 text-xs font-semibold rounded-control border transition-colors ${
                    currentPersona === 'helper'
                      ? 'bg-stamp text-on-stamp border-stamp'
                      : 'bg-sheet-2 text-ink border-rule hover:bg-sheet-3'
                  }`}
                >
                  Ben Morales (Helper)
                </button>
              </div>
              <p className="text-[11px] text-ink-3">
                {currentPersona === 'owner'
                  ? 'Owner mode: Full access to all clients, settings, and templates.'
                  : 'Helper mode: Restricted access strictly scoped to assigned clients (RSP & Cruz).'}
              </p>
            </div>

            {/* Theme switcher */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-2 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                <span>Theme Mode</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['system', 'light', 'dark'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTheme(mode)}
                    className={`px-2 py-1.5 text-xs font-medium capitalize rounded-control border transition-colors ${
                      theme === mode
                        ? 'bg-stamp text-on-stamp border-stamp'
                        : 'bg-sheet-2 text-ink border-rule hover:bg-sheet-3'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Offline Simulation & Failure Rate */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-rule">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-2 flex items-center gap-1.5">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Offline Mode</span>
                </label>
                <button
                  type="button"
                  onClick={toggleOffline}
                  className={`w-full py-1.5 px-3 text-xs font-semibold rounded-control border ${
                    offline
                      ? 'bg-critical-solid text-on-critical-solid border-critical-solid'
                      : 'bg-sheet-2 text-ink border-rule hover:bg-sheet-3'
                  }`}
                >
                  {offline ? 'Simulating Offline' : 'Online (Normal)'}
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Failure Rate</span>
                </label>
                <select
                  value={failureRate}
                  onChange={(e) => handleFailureRateChange(parseFloat(e.target.value))}
                  className="w-full py-1.5 px-2 text-xs font-medium rounded-control border border-rule-strong bg-sheet text-ink"
                >
                  <option value={0}>0% (Healthy)</option>
                  <option value={0.1}>10% Failures</option>
                  <option value={0.5}>50% Failures</option>
                  <option value={1}>100% (Outage)</option>
                </select>
              </div>
            </div>

            {/* Time Travel / Set Today */}
            <form onSubmit={handleSetToday} className="space-y-1.5 pt-2 border-t border-rule">
              <label className="text-xs font-semibold text-ink-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Time Travel / Set "Today"</span>
              </label>
              <div className="space-y-2">
                <DateField
                  value={todayVal || null}
                  onChange={(val) => setTodayVal(val || '')}
                  placeholder="Select or type date (e.g. Oct 28, +3)..."
                  showRelativeHint={true}
                />
                <div className="flex items-center justify-between pt-1">
                  {todayVal ? (
                    <button
                      type="button"
                      onClick={() => {
                        setTodayVal('');
                        devControls.setToday(null);
                        window.location.reload();
                      }}
                      className="text-xs text-ink-3 hover:text-critical-fg transition-colors cursor-pointer"
                    >
                      Reset to System
                    </button>
                  ) : <div />}
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong transition-colors cursor-pointer shadow-xs"
                  >
                    Apply Date
                  </button>
                </div>
              </div>
            </form>

            {/* Quick Links & Reset */}
            <div className="flex items-center justify-between pt-3 border-t border-rule text-xs">
              <div className="flex gap-3">
                <Link
                  to="/dev/tokens"
                  onClick={() => setIsOpen(false)}
                  className="text-stamp hover:underline font-semibold"
                >
                  Token Sheet
                </Link>
                <Link
                  to="/dev/states"
                  onClick={() => setIsOpen(false)}
                  className="text-stamp hover:underline font-semibold"
                >
                  State Gallery
                </Link>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Reset all sample data to initial state?')) {
                    devControls.reset();
                  }
                }}
                className="flex items-center gap-1 text-critical-fg hover:underline font-semibold"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset Sample Data</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
