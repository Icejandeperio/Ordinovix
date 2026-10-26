import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useClients, useTasks } from '@/hooks/useData';
import { useTheme, PALETTES } from '@/app/theme';
import { devControls } from '@/data';
import { centerModalStore } from '@/lib/modal-store';
import {
  Search,
  Plus,
  Users,
  CheckSquare,
  MapPin,
  Calendar,
  CreditCard,
  Send,
  BarChart2,
  Settings,
  HelpCircle,
  Sun,
  Moon,
  UserCheck,
  ArrowRight,
  Clock,
  Sparkles,
  ShieldCheck,
  LogOut,
  Palette,
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { theme, setTheme, isDark, palette, setPalette } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('ox-recent-searches');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const { data: clientsData } = useClients();
  const { data: tasksData } = useTasks();

  const clients = clientsData?.items || [];
  const tasks = tasksData?.items || [];

  // Global Keyboard listener for Ctrl+K, Cmd+K, and / key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }

      if (e.key === '/' && !open) {
        const target = e.target as HTMLElement | null;
        const tagName = target?.tagName;
        if (
          tagName !== 'INPUT' &&
          tagName !== 'TEXTAREA' &&
          !target?.isContentEditable
        ) {
          e.preventDefault();
          onOpenChange(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Notify global store when center command palette opens/closes
  useEffect(() => {
    if (!open) return;
    centerModalStore.open();
    return () => {
      centerModalStore.close();
    };
  }, [open]);

  const saveRecentSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recentSearches.filter((s) => s !== trimmed)].slice(0, 5);
    setRecentSearches(next);
    try {
      localStorage.setItem('ox-recent-searches', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleSelect = (callback: () => void, queryToSave?: string) => {
    if (queryToSave) {
      saveRecentSearch(queryToSave);
    }
    onOpenChange(false);
    callback();
  };

  const currentPersona = devControls.getPersona();

  const systemReducedMotion = useReducedMotion();
  const htmlReduceMotion =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-reduce-motion') === 'true';
  const shouldReduceMotion = systemReducedMotion || htmlReduceMotion;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 overflow-hidden">
          <motion.div
            key="cmd-backdrop"
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(6px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.22,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="fixed inset-0 bg-ink/40"
            onClick={() => onOpenChange(false)}
            aria-hidden="true"
          />

          <motion.div
            key="cmd-panel"
            initial={{
              opacity: shouldReduceMotion ? 1 : 0,
              scale: shouldReduceMotion ? 1 : 0.96,
              y: shouldReduceMotion ? 0 : -14,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: shouldReduceMotion ? 1 : 0,
              scale: shouldReduceMotion ? 1 : 0.96,
              y: shouldReduceMotion ? 0 : -10,
            }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.2,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative w-full max-w-xl bg-sheet border border-rule rounded-panel shadow-2xl overflow-hidden z-10 flex flex-col max-h-[80vh]"
          >
        <Command
          filter={(value, search) => {
            if (value.toLowerCase().includes(search.toLowerCase())) return 1;
            return 0;
          }}
          className="flex flex-col h-full w-full"
        >
          {/* Header Input */}
          <div className="flex items-center px-4 border-b border-rule shrink-0">
            <Search className="w-4 h-4 text-ink-3 mr-3 shrink-0" />
            <Command.Input
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="Type a command, search clients, or obligations... (Esc to close)"
              className="w-full py-3.5 text-sm bg-transparent border-0 text-ink placeholder:text-ink-3 focus:outline-none font-sans"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  saveRecentSearch(searchQuery);
                  onOpenChange(false);
                  navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                }
              }}
            />
          </div>

          {/* Results List */}
          <Command.List className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-none min-h-[220px]">
            <Command.Empty className="py-6 text-center text-xs text-ink-3">
              No results found for "{searchQuery}". Press Enter to run global search.
            </Command.Empty>

            {/* If searching, offer direct Search action */}
            {searchQuery.trim() && (
              <Command.Item
                value={`search-all ${searchQuery}`}
                onSelect={() =>
                  handleSelect(
                    () => navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`),
                    searchQuery
                  )
                }
                className="px-3 py-2 text-xs font-semibold rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-stamp-soft data-[selected=true]:text-stamp-strong hover:bg-sheet-2 text-stamp transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5" />
                  <span>Search all records for "{searchQuery}"</span>
                </div>
                <span className="text-[10px] text-ink-3">Enter ↵</span>
              </Command.Item>
            )}

            {/* Recent Searches */}
            {!searchQuery && recentSearches.length > 0 && (
              <Command.Group heading="Recent Searches" className="space-y-1">
                {recentSearches.map((term) => (
                  <Command.Item
                    key={term}
                    value={`recent ${term}`}
                    onSelect={() =>
                      handleSelect(() => navigate(`/search?q=${encodeURIComponent(term)}`))
                    }
                    className="px-3 py-1.5 text-xs rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-sheet-2 hover:bg-sheet-2 text-ink-2 hover:text-ink"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-ink-3" />
                      <span>{term}</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Quick Actions */}
            <Command.Group heading="Quick Actions" className="space-y-1">
              <Command.Item
                value="action new task create"
                onSelect={() => handleSelect(() => navigate('/tasks'))}
                className="px-3 py-2 text-xs font-semibold rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-stamp-soft data-[selected=true]:text-stamp-strong hover:bg-sheet-2 text-ink"
              >
                <div className="flex items-center gap-2.5">
                  <Plus className="w-3.5 h-3.5 text-stamp" />
                  <span>New Filing Task</span>
                </div>
                <span className="text-[10px] text-ink-3 font-mono">/tasks</span>
              </Command.Item>

              <Command.Item
                value="action new client register"
                onSelect={() => handleSelect(() => navigate('/clients'))}
                className="px-3 py-2 text-xs font-semibold rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-stamp-soft data-[selected=true]:text-stamp-strong hover:bg-sheet-2 text-ink"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-3.5 h-3.5 text-stamp" />
                  <span>Register New Client</span>
                </div>
                <span className="text-[10px] text-ink-3 font-mono">/clients</span>
              </Command.Item>

              <Command.Item
                value="action open period wizard"
                onSelect={() => handleSelect(() => navigate('/tasks'))}
                className="px-3 py-2 text-xs font-semibold rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-stamp-soft data-[selected=true]:text-stamp-strong hover:bg-sheet-2 text-ink"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-stamp" />
                  <span>Open Period Wizard</span>
                </div>
                <span className="text-[10px] text-ink-3 font-mono">/open-period</span>
              </Command.Item>

              <Command.Item
                value="action plan counter visit"
                onSelect={() => handleSelect(() => navigate('/visits'))}
                className="px-3 py-2 text-xs font-semibold rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-stamp-soft data-[selected=true]:text-stamp-strong hover:bg-sheet-2 text-ink"
              >
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-3.5 h-3.5 text-stamp" />
                  <span>Plan Office Visit</span>
                </div>
                <span className="text-[10px] text-ink-3 font-mono">/visits</span>
              </Command.Item>

              <Command.Item
                value="action toggle theme light dark"
                onSelect={() => handleSelect(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}
                className="px-3 py-2 text-xs font-semibold rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-stamp-soft data-[selected=true]:text-stamp-strong hover:bg-sheet-2 text-ink"
              >
                <div className="flex items-center gap-2.5">
                  {theme === 'dark' ? (
                    <Sun className="w-3.5 h-3.5 text-warn-fg" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-ink-2" />
                  )}
                  <span>Toggle Theme ({theme === 'dark' ? 'Light' : 'Dark'})</span>
                </div>
              </Command.Item>

              <Command.Item
                value="action switch persona operator helper ana ben"
                onSelect={() =>
                  handleSelect(() =>
                    devControls.setPersona(currentPersona === 'owner' ? 'helper' : 'owner')
                  )
                }
                className="px-3 py-2 text-xs font-semibold rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-stamp-soft data-[selected=true]:text-stamp-strong hover:bg-sheet-2 text-ink"
              >
                <div className="flex items-center gap-2.5">
                  <UserCheck className="w-3.5 h-3.5 text-stamp" />
                  <span>
                    Switch to {currentPersona === 'owner' ? 'Ben Morales (Helper)' : 'Ana Santos (Owner)'}
                  </span>
                </div>
              </Command.Item>

              <Command.Item
                value="action sign out logout leave session"
                onSelect={() => handleSelect(() => navigate('/sign-in'))}
                className="px-3 py-2 text-xs font-semibold rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-critical-bg data-[selected=true]:text-critical-fg hover:bg-sheet-2 text-ink hover:text-critical-fg transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <LogOut className="w-3.5 h-3.5 text-critical-solid" />
                  <span>Sign Out (Log Out)</span>
                </div>
                <span className="text-[10px] text-ink-3 font-mono">/sign-in</span>
              </Command.Item>
            </Command.Group>

            {/* Color Palettes */}
            <Command.Group heading="Color Palettes" className="space-y-1">
              {PALETTES.map((p) => {
                const isSelected = palette === p.id;
                return (
                  <Command.Item
                    key={p.id}
                    value={`palette theme color appearance ${p.id} ${p.name} ${p.tagline}`}
                    onSelect={() => handleSelect(() => setPalette(p.id))}
                    className="px-3 py-1.5 text-xs rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-stamp-soft data-[selected=true]:text-stamp-strong hover:bg-sheet-2 text-ink"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full border border-rule/60 shrink-0"
                        style={{ backgroundColor: isDark ? p.primaryDark : p.primaryLight }}
                        aria-hidden="true"
                      />
                      <span className="font-medium">{p.name}</span>
                      {isSelected && (
                        <span className="px-1.5 py-0.2 rounded-chip bg-stamp-soft text-stamp-strong text-[10px] font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-ink-3 truncate max-w-[140px]">{p.tagline}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>

            {/* Navigation Pages */}
            <Command.Group heading="Navigation" className="space-y-1">
              <Command.Item
                value="nav today dashboard focus"
                onSelect={() => handleSelect(() => navigate('/'))}
                className="px-3 py-1.5 text-xs rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-sheet-2 hover:bg-sheet-2 text-ink"
              >
                <div className="flex items-center gap-2.5">
                  <CheckSquare className="w-3.5 h-3.5 text-ink-3" />
                  <span>Today</span>
                </div>
                <span className="text-[10px] text-ink-3">/</span>
              </Command.Item>

              <Command.Item
                value="nav tasks filings obligations board"
                onSelect={() => handleSelect(() => navigate('/tasks'))}
                className="px-3 py-1.5 text-xs rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-sheet-2 hover:bg-sheet-2 text-ink"
              >
                <div className="flex items-center gap-2.5">
                  <CheckSquare className="w-3.5 h-3.5 text-ink-3" />
                  <span>Tasks</span>
                </div>
                <span className="text-[10px] text-ink-3">/tasks</span>
              </Command.Item>

              <Command.Item
                value="nav clients directory taxpayer"
                onSelect={() => handleSelect(() => navigate('/clients'))}
                className="px-3 py-1.5 text-xs rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-sheet-2 hover:bg-sheet-2 text-ink"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-3.5 h-3.5 text-ink-3" />
                  <span>Clients</span>
                </div>
                <span className="text-[10px] text-ink-3">/clients</span>
              </Command.Item>

              <Command.Item
                value="nav visits rdo bir counter trips pack"
                onSelect={() => handleSelect(() => navigate('/visits'))}
                className="px-3 py-1.5 text-xs rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-sheet-2 hover:bg-sheet-2 text-ink"
              >
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-3.5 h-3.5 text-ink-3" />
                  <span>Counter Visits</span>
                </div>
                <span className="text-[10px] text-ink-3">/visits</span>
              </Command.Item>

              <Command.Item
                value="nav calendar deadlines timeline"
                onSelect={() => handleSelect(() => navigate('/calendar'))}
                className="px-3 py-1.5 text-xs rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-sheet-2 hover:bg-sheet-2 text-ink"
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-3.5 h-3.5 text-ink-3" />
                  <span>Calendar</span>
                </div>
                <span className="text-[10px] text-ink-3">/calendar</span>
              </Command.Item>

              <Command.Item
                value="nav payments ledger receipts"
                onSelect={() => handleSelect(() => navigate('/payments'))}
                className="px-3 py-1.5 text-xs rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-sheet-2 hover:bg-sheet-2 text-ink"
              >
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-3.5 h-3.5 text-ink-3" />
                  <span>Payments</span>
                </div>
                <span className="text-[10px] text-ink-3">/payments</span>
              </Command.Item>

              <Command.Item
                value="nav follow-ups requests reminders"
                onSelect={() => handleSelect(() => navigate('/follow-ups'))}
                className="px-3 py-1.5 text-xs rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-sheet-2 hover:bg-sheet-2 text-ink"
              >
                <div className="flex items-center gap-2.5">
                  <Send className="w-3.5 h-3.5 text-ink-3" />
                  <span>Follow-ups</span>
                </div>
                <span className="text-[10px] text-ink-3">/follow-ups</span>
              </Command.Item>

              <Command.Item
                value="nav insights kpi reports metrics"
                onSelect={() => handleSelect(() => navigate('/insights'))}
                className="px-3 py-1.5 text-xs rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-sheet-2 hover:bg-sheet-2 text-ink"
              >
                <div className="flex items-center gap-2.5">
                  <BarChart2 className="w-3.5 h-3.5 text-ink-3" />
                  <span>Insights</span>
                </div>
                <span className="text-[10px] text-ink-3">/insights</span>
              </Command.Item>

              <Command.Item
                value="nav settings preferences profile access"
                onSelect={() => handleSelect(() => navigate('/settings'))}
                className="px-3 py-1.5 text-xs rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-sheet-2 hover:bg-sheet-2 text-ink"
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="w-3.5 h-3.5 text-ink-3" />
                  <span>Settings</span>
                </div>
                <span className="text-[10px] text-ink-3">/settings</span>
              </Command.Item>

              {currentPersona === 'owner' && (
                <Command.Item
                  value="nav super admin user accounts permissions access control helper owner allowlist"
                  onSelect={() => handleSelect(() => navigate('/settings/users'))}
                  className="px-3 py-1.5 text-xs rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-sheet-2 hover:bg-sheet-2 text-ink"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-stamp" />
                    <span>Super Admin: Users & Access</span>
                  </div>
                  <span className="text-[10px] text-stamp font-medium">/admin</span>
                </Command.Item>
              )}

              <Command.Item
                value="nav help glossary shortcuts support"
                onSelect={() => handleSelect(() => navigate('/help'))}
                className="px-3 py-1.5 text-xs rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-sheet-2 hover:bg-sheet-2 text-ink"
              >
                <div className="flex items-center gap-2.5">
                  <HelpCircle className="w-3.5 h-3.5 text-ink-3" />
                  <span>Help & Glossary</span>
                </div>
                <span className="text-[10px] text-ink-3">/help</span>
              </Command.Item>
            </Command.Group>

            {/* Clients List */}
            {clients.length > 0 && (
              <Command.Group heading="Clients" className="space-y-1">
                {clients.slice(0, 5).map((c) => (
                  <Command.Item
                    key={c.client.id}
                    value={`client ${c.client.displayName} ${c.client.code} ${c.client.tinMasked || ''}`}
                    onSelect={() =>
                      handleSelect(
                        () => navigate(`/clients/${c.client.id}`),
                        c.client.displayName
                      )
                    }
                    className="px-3 py-1.5 text-xs rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-stamp-soft data-[selected=true]:text-stamp-strong hover:bg-sheet-2 text-ink"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded-chip bg-sheet-2 border border-rule text-[10px] font-bold text-ink">
                        {c.client.code}
                      </span>
                      <span className="font-semibold truncate max-w-[240px]">
                        {c.client.displayName}
                      </span>
                    </div>
                    <span className="text-[10px] text-ink-3 font-mono">
                      {c.client.rdoCode ? `RDO ${c.client.rdoCode}` : c.client.entityType}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Tasks List */}
            {tasks.length > 0 && (
              <Command.Group heading="Open Tasks" className="space-y-1">
                {tasks.slice(0, 5).map((t) => (
                  <Command.Item
                    key={t.task.id}
                    value={`task ${t.task.title || ''} ${t.client.displayName} ${t.client.code} ${t.task.period || ''}`}
                    onSelect={() =>
                      handleSelect(
                        () => navigate(`/tasks/${t.task.id}`),
                        t.task.title || t.client.displayName
                      )
                    }
                    className="px-3 py-1.5 text-xs rounded-control flex items-center justify-between cursor-pointer data-[selected=true]:bg-stamp-soft data-[selected=true]:text-stamp-strong hover:bg-sheet-2 text-ink"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="px-1.5 py-0.2 rounded-chip bg-sheet-2 border border-rule text-[10px] font-bold text-ink">
                        {t.client.code}
                      </span>
                      <span className="truncate max-w-[200px]">{t.task.title}</span>
                    </div>
                    <span className="text-[10px] text-ink-3 shrink-0">
                      {t.task.period} · {t.task.status}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer Shortcuts hint */}
          <div className="px-4 py-2 bg-sheet-2 border-t border-rule text-[11px] text-ink-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="px-1.5 py-0.5 rounded-chip bg-sheet border border-rule font-mono text-[10px]">
                  ↑
                </kbd>{' '}
                <kbd className="px-1.5 py-0.5 rounded-chip bg-sheet border border-rule font-mono text-[10px]">
                  ↓
                </kbd>{' '}
                Navigate
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 rounded-chip bg-sheet border border-rule font-mono text-[10px]">
                  ↵
                </kbd>{' '}
                Select
              </span>
            </div>
            <span>
              <kbd className="px-1.5 py-0.5 rounded-chip bg-sheet border border-rule font-mono text-[10px]">
                Esc
              </kbd>{' '}
              Close
            </span>
          </div>
        </Command>
      </motion.div>
    </div>
      )}
    </AnimatePresence>
  );
}
