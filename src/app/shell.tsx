import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSession, useUnreadNotificationsCount } from '@/hooks/useData';
import { devControls } from '@/data';
import {
  CalendarDays,
  CheckSquare,
  Users,
  MessageSquare,
  MapPin,
  FileText,
  DollarSign,
  Building2,
  BarChart3,
  FileSpreadsheet,
  Settings,
  Bell,
  Search,
  HelpCircle,
  Menu,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Eye,
  EyeOff,
  Lock,
  WifiOff,
  Download,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DevMenu } from './dev-menu';
import { CommandPalette } from '@/components/command-palette';
import { NotificationsPopover } from '@/components/notifications-popover';

// Logomark SVG component
export function LogoMark({ className = 'w-7 h-7 text-stamp' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="6" strokeWidth="2" />
      <rect x="5" y="5" width="22" height="22" rx="3.5" strokeWidth="1" />
      <circle cx="16" cy="16" r="6" strokeWidth="3.2" />
    </svg>
  );
}

export function AppShell() {
  const { data: session } = useSession();
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();
  const navigate = useNavigate();
  const [commandOpen, setCommandOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Privacy Mode State (Section 19.5: Shift+P)
  const [privacyMode, setPrivacyMode] = useState(() => {
    try {
      return localStorage.getItem('ordinovix:privacy_mode') === 'true';
    } catch {
      return false;
    }
  });

  const togglePrivacyMode = () => {
    setPrivacyMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ordinovix:privacy_mode', String(next));
      } catch {}
      return next;
    });
  };

  // Idle Lock State (Section 19.5: default 15 mins)
  const [isIdleLocked, setIsIdleLocked] = useState(false);

  // Offline detection
  const isDevOffline = devControls.getOffline();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('ordinovix:sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ordinovix:sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Listeners: Ctrl+[ for sidebar, Shift+P for privacy mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        toggleCollapsed();
      }
      if (e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        togglePrivacyMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Idle timer listener (Section 19.5)
  useEffect(() => {
    const rawTimeout = localStorage.getItem('ordinovix:idle_timeout') || '15';
    if (rawTimeout === 'off') return;
    const timeoutMs = parseInt(rawTimeout, 10) * 60 * 1000;

    let timer = setTimeout(() => {
      setIsIdleLocked(true);
    }, timeoutMs);

    const resetIdleTimer = () => {
      if (!isIdleLocked) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          setIsIdleLocked(true);
        }, timeoutMs);
      }
    };

    const events = ['mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetIdleTimer, { passive: true }));

    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetIdleTimer));
    };
  }, [isIdleLocked]);

  // Capture PWA install prompt (Section 19.3)
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const location = useLocation();
  const currentPersona = devControls.getPersona();
  const isHelper = currentPersona === 'helper';

  const navItems = [
    { to: '/', label: 'Today', icon: CalendarDays },
    { to: '/tasks', label: 'Tasks', icon: CheckSquare },
    { to: '/clients', label: 'Clients', icon: Users },
    { to: '/follow-ups', label: 'Follow-ups', icon: MessageSquare },
    { to: '/visits', label: 'Visits', icon: MapPin },
    { to: '/calendar', label: 'Calendar', icon: CalendarDays },
    { to: '/documents', label: 'Documents', icon: FileText },
    { to: '/payments', label: 'Payments', icon: DollarSign },
    { to: '/offices', label: 'Offices', icon: Building2 },
    { to: '/insights', label: 'Insights', icon: BarChart3 },
    { to: '/reports', label: 'Reports', icon: FileSpreadsheet },
    ...(!isHelper ? [{ to: '/audit', label: 'Audit Log', icon: ShieldAlert }] : []),
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/help', label: 'Help', icon: HelpCircle },
  ];

  return (
    <div className={`h-screen max-h-screen flex flex-col bg-paper text-ink overflow-hidden ${privacyMode ? 'privacy-mode' : ''}`}>
      {/* Skip to Content Link (Section 19.1 WCAG 2.2 AA) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-stamp focus:text-on-stamp focus:rounded-control focus:text-xs focus:font-bold focus:shadow-md"
      >
        Skip to content
      </a>

      {/* Sample data banner */}
      <div className="shrink-0 bg-stamp-soft text-stamp-strong border-b border-rule px-4 py-1 text-center text-xs font-semibold flex items-center justify-center gap-2 z-30 sample-data-banner">
        <span className="w-2 h-2 rounded-full bg-stamp animate-pulse" />
        <span>Sample Data Mode</span>
        <span className="text-ink-3">|</span>
        <span className="text-ink-2">
          Persona: <strong>{currentPersona === 'owner' ? 'Ana Santos (Owner)' : 'Ben Morales (Helper)'}</strong>
        </span>
      </div>

      {/* Offline Status Banner (Section 19.3) */}
      {isDevOffline && (
        <div className="shrink-0 bg-warn-bg text-warn-fg border-b border-warn-bd px-4 py-1 text-center text-xs font-semibold flex items-center justify-center gap-2 z-30" role="status" aria-live="polite">
          <WifiOff className="w-3.5 h-3.5 text-warn-solid" />
          <span>Working offline. Changes are saved locally and will sync when reconnected.</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Desktop Sidebar (>=1024px) / Tablet Rail (640px-1023px) */}
        <aside
          className={`hidden sm:flex flex-col border-r border-rule bg-sheet transition-all duration-200 z-30 relative shrink-0 h-full ${
            collapsed ? 'w-[72px]' : 'lg:w-[248px] sm:w-[72px]'
          }`}
        >
          {/* Center border notch collapse/expand toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden sm:flex items-center justify-center absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-9 rounded-full bg-sheet hover:bg-sheet-2 border border-rule hover:border-stamp/60 shadow-xs hover:shadow-md text-ink-2 hover:text-stamp transition-all duration-200 cursor-pointer z-40 group hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stamp/40"
            title={collapsed ? 'Expand sidebar (Ctrl+[)' : 'Collapse sidebar (Ctrl+[)'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5 stroke-[2.5] text-ink-2 group-hover:text-stamp transition-colors" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5] text-ink-2 group-hover:text-stamp transition-colors" />
            )}
          </button>

          {/* Logo & Brand Header */}
          <div className={`h-14 shrink-0 border-b border-rule flex items-center overflow-hidden ${collapsed ? 'px-2 justify-center' : 'px-4'}`}>
            <NavLink
              to="/"
              className={`flex items-center transition-opacity hover:opacity-90 ${collapsed ? 'justify-center' : 'gap-2.5 min-w-0'}`}
              title="Ordinovix"
            >
              <LogoMark className="w-7 h-7 text-stamp shrink-0" />
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-base tracking-tight font-sans text-ink truncate">Ordinovix</span>
                  <span className="text-[10px] text-ink-3 tracking-wider uppercase -mt-0.5 truncate">Tax Practice</span>
                </div>
              )}
            </NavLink>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 min-h-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`transition-colors rounded-control text-xs font-semibold flex items-center ${
                    collapsed
                      ? 'w-10 h-10 mx-auto justify-center'
                      : 'gap-3 px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-stamp-soft text-stamp-strong ' + (collapsed ? 'ring-1 ring-stamp/30' : 'border-l-2 border-stamp')
                      : 'text-ink-2 hover:bg-sheet-2 hover:text-ink'
                  }`}
                  title={item.label}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>

          {/* User profile / Organization footer */}
          <div className={`p-3 shrink-0 mt-auto border-t border-rule bg-sheet-2 flex items-center overflow-hidden ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
            <div
              className="w-8 h-8 rounded-full bg-stamp text-on-stamp flex items-center justify-center text-xs font-bold shrink-0 shadow-xs"
              title={currentPersona === 'owner' ? 'Ana Santos (Owner)' : 'Ben Morales (Helper)'}
            >
              {currentPersona === 'owner' ? 'AS' : 'BM'}
            </div>
            {!collapsed && (
              <div className="overflow-hidden min-w-0">
                <div className="text-xs font-bold text-ink truncate">
                  {currentPersona === 'owner' ? 'Ana Santos' : 'Ben Morales'}
                </div>
                <div className="text-[11px] text-ink-3 truncate">
                  {currentPersona === 'owner' ? 'Preparer / Owner' : 'Helper Account'}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-full min-h-0">
          {/* Top Bar (56px) */}
          <header className="h-14 shrink-0 border-b border-rule bg-sheet/95 backdrop-blur-xs flex items-center justify-between px-4 sm:px-6 z-20">
            {/* Left brand on mobile */}
            <div className="flex items-center gap-3 sm:hidden">
              <LogoMark className="w-7 h-7 text-stamp" />
              <span className="font-bold text-base tracking-tight font-sans text-ink">Ordinovix</span>
            </div>

            {/* Title / breadcrumb / Search trigger */}
            <div className="hidden sm:flex items-center gap-3 flex-1 max-w-md">
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="relative w-full text-left"
              >
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <div className="w-full pl-9 pr-4 py-1.5 text-xs rounded-control bg-sheet-2 border border-rule text-ink-3 hover:bg-sheet-3 transition-colors flex items-center justify-between cursor-pointer">
                  <span>Search clients, tasks, documents...</span>
                  <kbd className="px-1.5 py-0.2 rounded-chip bg-sheet border border-rule font-mono text-[10px] text-ink-3">
                    Ctrl K
                  </kbd>
                </div>
              </button>
            </div>

            {/* Right icons */}
            <div className="flex items-center gap-2 sm:gap-3 relative">
              {/* Privacy Mode Toggle (Section 19.5) */}
              <button
                type="button"
                onClick={togglePrivacyMode}
                className={`p-2 rounded-control text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  privacyMode
                    ? 'bg-warn-bg text-warn-fg border border-warn-bd shadow-xs'
                    : 'text-ink-2 hover:bg-sheet-2 hover:text-ink'
                }`}
                title="Privacy Mode (Shift+P) — Blurs sensitive taxpayer records and amounts"
                aria-label="Toggle Privacy Mode (Shift+P)"
                aria-pressed={privacyMode}
              >
                {privacyMode ? <EyeOff className="w-4 h-4 text-warn-fg" /> : <Eye className="w-4 h-4" />}
                <span className="hidden md:inline">{privacyMode ? 'Privacy On' : 'Privacy'}</span>
              </button>

              {/* Install App Button (Section 19.3) */}
              {installPrompt && (
                <button
                  type="button"
                  onClick={() => {
                    installPrompt.prompt();
                    setInstallPrompt(null);
                  }}
                  className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-control bg-sheet-2 border border-rule text-xs font-semibold text-ink hover:bg-sheet-3 transition-colors"
                  title="Install Ordinovix application"
                >
                  <Download className="w-3.5 h-3.5 text-stamp" />
                  <span>Install</span>
                </button>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className={`relative p-2 rounded-control hover:bg-sheet-2 transition-colors ${
                    notificationsOpen ? 'bg-sheet-2 text-stamp' : 'text-ink-2 hover:text-ink'
                  }`}
                  title="Notifications"
                  aria-expanded={notificationsOpen}
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-critical-solid ring-2 ring-sheet" />
                  )}
                </button>

                <NotificationsPopover
                  open={notificationsOpen}
                  onClose={() => setNotificationsOpen(false)}
                />
              </div>

              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-rule text-xs text-ink-2">
                <span className="font-semibold">{session?.org.name || 'Santos Tax Services'}</span>
              </div>
            </div>
          </header>

          {/* Page Content Viewport with Landmark and WCAG 2.2 AA scroll padding */}
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 overflow-y-auto min-h-0 w-full focus:outline-none"
            style={{ scrollPaddingTop: '72px', scrollPaddingBottom: '72px' }}
          >
            <div className="max-w-[1400px] w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 sm:pb-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Idle Lock Curtain Overlay (Section 19.5) */}
      {isIdleLocked && (
        <div className="fixed inset-0 z-50 bg-paper/95 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center">
          <div className="max-w-sm w-full bg-sheet border border-rule rounded-xl p-8 shadow-xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-stamp-soft text-stamp flex items-center justify-center mx-auto border border-stamp/20 shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-ink">Session Inactivity Lock</h2>
              <p className="text-xs text-ink-2 leading-relaxed">
                Ordinovix is locked to protect sensitive taxpayer data and BIR filings.
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setIsIdleLocked(false)}
                className="w-full py-2.5 px-4 rounded-control bg-stamp text-on-stamp text-xs font-bold hover:bg-stamp-strong transition-colors"
              >
                Unlock Session
              </button>
              <button
                type="button"
                onClick={() => navigate('/sign-in')}
                className="w-full py-2.5 px-4 rounded-control border border-rule bg-sheet text-ink-2 hover:bg-sheet-2 hover:text-ink text-xs font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Bar (<640px) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 h-16 bg-sheet border-t border-rule flex items-center justify-around z-40 px-2 pb-[env(safe-area-inset-bottom)]">
        {[
          { to: '/', label: 'Today', icon: CalendarDays },
          { to: '/tasks', label: 'Tasks', icon: CheckSquare },
          { to: '/clients', label: 'Clients', icon: Users },
          { to: '/visits', label: 'Visits', icon: MapPin },
          { to: '/insights', label: 'Insights', icon: BarChart3 },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center w-14 py-1 text-[11px] font-semibold transition-colors ${
                isActive ? 'text-stamp' : 'text-ink-3 hover:text-ink'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Developer Drawer */}
      <DevMenu />

      {/* Global Command Palette (cmdk) */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
