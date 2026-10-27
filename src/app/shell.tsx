import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ShieldAlert,
  Eye,
  EyeOff,
  Lock,
  WifiOff,
  Download,
  LogOut,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DevMenu } from './dev-menu';
import { isMockData } from '@/lib/data-source';
import { CommandPalette } from '@/components/command-palette';
import { NotificationsPopover } from '@/components/notifications-popover';
import { useIsCenterModalOpen } from '@/lib/modal-store';
import { calculateAutoscrollVelocity, isElementScrollable } from '@/lib/sidebar-autoscroll';

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
  const isModalOpen = useIsCenterModalOpen();
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
      const stored = localStorage.getItem('ordinovix:sidebar_collapsed');
      if (stored !== null) return stored === 'true';
      return typeof window !== 'undefined' && window.innerWidth < 1024;
    } catch {
      return false;
    }
  });

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Auto-collapse sidebar on viewport transition below 1024px if not explicitly overridden
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        try {
          if (localStorage.getItem('ordinovix:sidebar_collapsed') === null) {
            setCollapsed(true);
          }
        } catch {
          setCollapsed(true);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ordinovix:sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Compacted Sidebar Autoscroll Engine (locked autoscroll on hover)
  const navRef = useRef<HTMLElement>(null);
  const velocityRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const [autoscrollState, setAutoscrollState] = useState<{
    active: boolean;
    direction: 'up' | 'down' | 'idle';
    mouseY: number;
    isScrollable: boolean;
  }>({
    active: false,
    direction: 'idle',
    mouseY: 0,
    isScrollable: false,
  });

  const stopAutoscroll = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    velocityRef.current = 0;
    setAutoscrollState((prev) => (prev.active ? { ...prev, active: false, direction: 'idle' } : prev));
  }, []);

  const startAutoscrollLoop = useCallback(() => {
    if (animFrameRef.current !== null) return;

    const scrollLoop = () => {
      if (velocityRef.current !== 0 && navRef.current) {
        navRef.current.scrollTop += velocityRef.current;
      }
      animFrameRef.current = requestAnimationFrame(scrollLoop);
    };

    animFrameRef.current = requestAnimationFrame(scrollLoop);
  }, []);

  const handleNavMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!collapsed || !navRef.current) return;
      const scrollable = isElementScrollable(navRef.current);
      if (!scrollable) {
        if (autoscrollState.active) stopAutoscroll();
        return;
      }

      const rect = navRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const result = calculateAutoscrollVelocity(relativeY, rect.height);

      velocityRef.current = result.velocity;
      setAutoscrollState({
        active: true,
        direction: result.direction,
        mouseY: relativeY,
        isScrollable: true,
      });

      startAutoscrollLoop();
    },
    [collapsed, autoscrollState.active, stopAutoscroll, startAutoscrollLoop]
  );

  const handleNavMouseLeave = useCallback(() => {
    stopAutoscroll();
  }, [stopAutoscroll]);

  // Clean up autoscroll when collapsing/uncollapsing or unmounting
  useEffect(() => {
    if (!collapsed) {
      stopAutoscroll();
    }
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [collapsed, stopAutoscroll]);

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

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

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

      {/* Sample data banner (mock mode only) */}
      {isMockData && (
      <div
        className={`shrink-0 bg-stamp-soft text-stamp-strong border-b border-rule px-4 py-1 text-center text-xs font-semibold flex items-center justify-center gap-2 z-30 sample-data-banner transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isModalOpen ? '-translate-y-full pointer-events-none opacity-0 h-0 py-0 overflow-hidden border-b-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-stamp animate-pulse" />
        <span>Sample Data Mode</span>
        <span className="text-ink-3">|</span>
        <span className="text-ink-2">
          Persona: <strong>{currentPersona === 'owner' ? 'Ana Santos (Owner)' : 'Ben Morales (Helper)'}</strong>
        </span>
      </div>
      )}

      {/* Offline Status Banner (Section 19.3) */}
      {isDevOffline && (
        <div
          className={`shrink-0 bg-warn-bg text-warn-fg border-b border-warn-bd px-4 py-1 text-center text-xs font-semibold flex items-center justify-center gap-2 z-30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isModalOpen ? '-translate-y-full pointer-events-none opacity-0 h-0 py-0 overflow-hidden border-b-0' : 'translate-y-0 opacity-100'
          }`}
          role="status"
          aria-live="polite"
        >
          <WifiOff className="w-3.5 h-3.5 text-warn-solid" />
          <span>Working offline. Changes are saved locally and will sync when reconnected.</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Desktop Sidebar (>=1024px) / Tablet Rail (640px-1023px) */}
        <aside
          className={`hidden sm:flex flex-col border-r border-rule bg-sheet transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-30 relative shrink-0 h-full ${
            collapsed ? 'w-[72px]' : 'w-[248px]'
          } ${
            isModalOpen ? '-translate-x-full pointer-events-none opacity-0' : 'translate-x-0 opacity-100'
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
          <nav
            ref={navRef}
            onMouseMove={handleNavMouseMove}
            onMouseEnter={handleNavMouseMove}
            onMouseLeave={handleNavMouseLeave}
            className={`flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-1 min-h-0 relative ${
              collapsed ? 'no-scrollbar' : ''
            } ${
              collapsed && autoscrollState.active && autoscrollState.isScrollable
                ? autoscrollState.direction === 'up'
                  ? 'cursor-n-resize'
                  : autoscrollState.direction === 'down'
                  ? 'cursor-s-resize'
                  : 'cursor-ns-resize'
                : ''
            }`}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`transition-colors rounded-control text-xs font-semibold flex items-center min-w-0 ${
                    collapsed
                      ? 'w-10 h-10 mx-auto justify-center'
                      : 'gap-3 px-3 py-2 w-full'
                  } ${
                    isActive
                      ? 'bg-stamp-soft text-stamp-strong ' + (collapsed ? 'ring-1 ring-stamp/30' : 'border-l-2 border-stamp')
                      : 'text-ink-2 hover:bg-sheet-2 hover:text-ink'
                  }`}
                  title={item.label}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate min-w-0">{item.label}</span>}
                </NavLink>
              );
            })}

            {/* Middle-click style autoscroll HUD indicator when hovering compacted scrollable sidebar */}
            {collapsed && autoscrollState.active && autoscrollState.isScrollable && (
              <div
                className="absolute right-0.5 w-4 h-6 rounded-full bg-[var(--sheet)]/95 border border-[var(--stamp)]/40 shadow-xs flex flex-col items-center justify-between py-0.5 pointer-events-none z-30 transition-transform duration-75 ease-out"
                style={{
                  top: Math.max(8, Math.min(navRef.current ? navRef.current.clientHeight - 32 : 200, autoscrollState.mouseY - 12)),
                }}
                aria-hidden="true"
              >
                <ChevronUp
                  className={`w-2.5 h-2.5 transition-colors ${
                    autoscrollState.direction === 'up'
                      ? 'text-[var(--stamp)] stroke-[3]'
                      : 'text-[var(--ink-3)]/40'
                  }`}
                />
                <div
                  className={`w-1 h-1 rounded-full transition-colors ${
                    autoscrollState.direction === 'idle'
                      ? 'bg-[var(--stamp)]'
                      : 'bg-[var(--ink-3)]/30'
                  }`}
                />
                <ChevronDown
                  className={`w-2.5 h-2.5 transition-colors ${
                    autoscrollState.direction === 'down'
                      ? 'text-[var(--stamp)] stroke-[3]'
                      : 'text-[var(--ink-3)]/40'
                  }`}
                />
              </div>
            )}
          </nav>

          {/* User profile / Organization footer */}
          <div className={`p-3 shrink-0 mt-auto border-t border-rule bg-sheet-2 flex items-center overflow-hidden ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
            <button
              type="button"
              onClick={() => {
                if (collapsed) navigate('/sign-in');
              }}
              className="w-8 h-8 rounded-full bg-stamp text-on-stamp flex items-center justify-center text-xs font-bold shrink-0 shadow-xs cursor-pointer hover:opacity-90"
              title={collapsed ? `Sign out (${currentPersona === 'owner' ? 'Ana Santos' : 'Ben Morales'})` : (currentPersona === 'owner' ? 'Ana Santos (Owner)' : 'Ben Morales (Helper)')}
            >
              {currentPersona === 'owner' ? 'AS' : 'BM'}
            </button>
            {!collapsed && (
              <>
                <div className="overflow-hidden min-w-0 flex-1">
                  <div className="text-xs font-bold text-ink truncate">
                    {currentPersona === 'owner' ? 'Ana Santos' : 'Ben Morales'}
                  </div>
                  <div className="text-[11px] text-ink-3 truncate">
                    {currentPersona === 'owner' ? 'Preparer / Owner' : 'Helper Account'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/sign-in')}
                  className="p-1.5 rounded-control text-ink-3 hover:text-critical-fg hover:bg-sheet-3 transition-colors cursor-pointer shrink-0"
                  title="Sign out (Log out)"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-full min-h-0">
          {/* Top Bar (56px) */}
          <header
            className={`h-14 shrink-0 border-b border-rule bg-sheet/95 backdrop-blur-xs flex items-center justify-between px-3 sm:px-6 z-20 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isModalOpen ? '-translate-y-full pointer-events-none opacity-0' : 'translate-y-0 opacity-100'
            }`}
          >
            {/* Left brand on mobile */}
            <div className="flex items-center gap-2 sm:hidden min-w-0">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="p-1.5 -ml-1 rounded-control text-ink-2 hover:bg-sheet-2 hover:text-ink transition-colors cursor-pointer"
                title="Open Navigation Menu"
                aria-label="Open Navigation Menu"
              >
                <Menu className="w-5 h-5 text-ink" />
              </button>
              <NavLink to="/" className="flex items-center gap-2 min-w-0" title="Ordinovix">
                <LogoMark className="w-6 h-6 text-stamp shrink-0" />
                <span className="font-bold text-base tracking-tight font-sans text-ink truncate">Ordinovix</span>
              </NavLink>
            </div>

            {/* Title / breadcrumb / Search trigger */}
            <div className="hidden sm:flex items-center gap-3 flex-1 max-w-xs md:max-w-sm lg:max-w-md">
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="relative w-full text-left"
              >
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <div className="w-full pl-9 pr-3 sm:pr-4 py-1.5 text-xs rounded-control bg-sheet-2 border border-rule text-ink-3 hover:bg-sheet-3 transition-colors flex items-center justify-between cursor-pointer min-w-0">
                  <span className="truncate">Search clients, tasks...</span>
                  <kbd className="px-1.5 py-0.2 rounded-chip bg-sheet border border-rule font-mono text-[10px] text-ink-3 shrink-0 ml-1.5">
                    Ctrl K
                  </kbd>
                </div>
              </button>
            </div>

            {/* Right icons */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 relative">
              {/* Mobile Search Button */}
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="sm:hidden p-2 rounded-control text-ink-2 hover:bg-sheet-2 transition-colors cursor-pointer"
                title="Search (Ctrl+K)"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Privacy Mode Toggle (Section 19.5) */}
              <button
                type="button"
                onClick={togglePrivacyMode}
                className={`p-2 rounded-control text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  privacyMode
                    ? 'bg-warn-bg text-warn-fg border border-warn-bd shadow-xs'
                    : 'text-ink-2 hover:bg-sheet-2 hover:text-ink'
                }`}
                title="Privacy Mode (Shift+P) — Blurs sensitive taxpayer records and amounts"
                aria-label="Toggle Privacy Mode (Shift+P)"
                aria-pressed={privacyMode}
              >
                {privacyMode ? <EyeOff className="w-4 h-4 text-warn-fg" /> : <Eye className="w-4 h-4" />}
                <span className="hidden lg:inline">{privacyMode ? 'Privacy On' : 'Privacy'}</span>
              </button>

              {/* Install App Button (Section 19.3) */}
              {installPrompt && (
                <button
                  type="button"
                  onClick={() => {
                    installPrompt.prompt();
                    setInstallPrompt(null);
                  }}
                  className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-control bg-sheet-2 border border-rule text-xs font-semibold text-ink hover:bg-sheet-3 transition-colors cursor-pointer"
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
                  className={`relative p-2 rounded-control hover:bg-sheet-2 transition-colors cursor-pointer ${
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

              <div className="hidden md:flex items-center gap-2 pl-2 border-l border-rule text-xs text-ink-2 min-w-0">
                <span className="font-semibold truncate max-w-[130px] lg:max-w-none">{session?.org.name || 'Santos Tax Services'}</span>
                <button
                  type="button"
                  onClick={() => navigate('/sign-in')}
                  className="p-1.5 rounded-control text-ink-3 hover:text-critical-fg hover:bg-sheet-2 transition-colors cursor-pointer ml-0.5 shrink-0"
                  title="Sign out (Log out)"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Page Content Viewport with Landmark and WCAG 2.2 AA scroll padding */}
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-full focus:outline-none"
            style={{ scrollPaddingTop: '72px', scrollPaddingBottom: '72px' }}
          >
            <div className="max-w-[1400px] w-full mx-auto p-3 sm:p-5 lg:p-8 pb-24 sm:pb-8 min-w-0">
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
      <nav
        className={`sm:hidden fixed bottom-0 left-0 right-0 h-16 bg-sheet border-t border-rule flex items-center justify-around z-40 px-2 pb-[env(safe-area-inset-bottom)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isModalOpen ? 'translate-y-full pointer-events-none opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
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

      {/* Mobile Slide-Over Navigation Drawer (< 640px) */}
      {mobileDrawerOpen && (
        <div
          className="sm:hidden fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[80vw] bg-sheet h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="h-14 px-4 border-b border-rule flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <LogoMark className="w-6 h-6 text-stamp shrink-0" />
                <span className="font-bold text-base font-sans text-ink">Ordinovix</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-control text-ink-3 hover:text-ink hover:bg-sheet-2 transition-colors cursor-pointer"
                aria-label="Close Navigation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nav Links */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-control text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-stamp-soft text-stamp-strong border-l-2 border-stamp'
                        : 'text-ink-2 hover:bg-sheet-2 hover:text-ink'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>

            {/* User Profile Footer */}
            <div className="p-3 border-t border-rule bg-sheet-2 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-stamp text-on-stamp flex items-center justify-center text-xs font-bold shrink-0">
                  {currentPersona === 'owner' ? 'AS' : 'BM'}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-ink truncate">
                    {currentPersona === 'owner' ? 'Ana Santos' : 'Ben Morales'}
                  </div>
                  <div className="text-[10px] text-ink-3 truncate">
                    {session?.org.name || 'Santos Tax Services'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  navigate('/sign-in');
                }}
                className="p-1.5 rounded-control text-ink-3 hover:text-critical-fg hover:bg-sheet-3 transition-colors cursor-pointer shrink-0"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Developer Drawer (mock mode only) */}
      {isMockData && <DevMenu />}

      {/* Global Command Palette (cmdk) */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
