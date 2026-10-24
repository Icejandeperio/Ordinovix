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
} from 'lucide-react';
import { DevMenu } from './dev-menu';

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      {/* Sample data banner */}
      <div className="bg-stamp-soft text-stamp-strong border-b border-rule px-4 py-1 text-center text-xs font-semibold flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-stamp animate-pulse" />
        <span>Sample Data Mode</span>
        <span className="text-ink-3">|</span>
        <span className="text-ink-2">
          Persona: <strong>{currentPersona === 'owner' ? 'Ana Santos (Owner)' : 'Ben Morales (Helper)'}</strong>
        </span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar (>=1024px) / Tablet Rail (640px-1023px) */}
        <aside
          className={`hidden sm:flex flex-col border-r border-rule bg-sheet transition-all duration-200 z-30 relative ${
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
          <div className={`h-14 border-b border-rule flex items-center ${collapsed ? 'px-2 justify-center' : 'px-4'}`}>
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
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
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
          <div className={`p-3 border-t border-rule bg-sheet-2 flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
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
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Bar (56px) */}
          <header className="h-14 border-b border-rule bg-sheet/95 backdrop-blur-xs flex items-center justify-between px-4 sm:px-6 z-20">
            {/* Left brand on mobile */}
            <div className="flex items-center gap-3 sm:hidden">
              <LogoMark className="w-7 h-7 text-stamp" />
              <span className="font-bold text-base tracking-tight font-sans text-ink">Ordinovix</span>
            </div>

            {/* Title / breadcrumb / Search trigger */}
            <div className="hidden sm:flex items-center gap-3 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  type="text"
                  placeholder="Search clients, tasks, documents... (Ctrl+K)"
                  className="w-full pl-9 pr-4 py-1.5 text-xs rounded-control bg-sheet-2 border border-rule text-ink placeholder:text-ink-3 focus:bg-sheet focus:border-stamp focus:outline-none"
                />
              </div>
            </div>

            {/* Right icons */}
            <div className="flex items-center gap-3">
              <NavLink
                to="/notifications"
                className="relative p-2 rounded-control hover:bg-sheet-2 text-ink-2 hover:text-ink"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-critical-solid" />
                )}
              </NavLink>

              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-rule text-xs text-ink-2">
                <span className="font-semibold">{session?.org.name || 'Santos Tax Services'}</span>
              </div>
            </div>
          </header>

          {/* Page Content Viewport */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 sm:pb-8 max-w-[1400px] w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>

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
    </div>
  );
}
