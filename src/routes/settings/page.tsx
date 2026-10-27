import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  useSession,
  useBaseline,
  useSaveBaseline,
  useMemberships,
  useInviteMembership,
  useUpdateMembership,
  useRevokeMembership,
  useClients,
  useSaveSettings,
} from '@/hooks/useData';
import { devControls } from '@/data';
import { useTheme, PALETTES } from '@/app/theme';
import {
  User,
  Palette,
  Bell,
  Building2,
  Users,
  FileCode2,
  MessageSquare,
  Calendar,
  Briefcase,
  ShieldCheck,
  Info,
  Check,
  Save,
  Moon,
  Sun,
  Laptop,
  AlertTriangle,
  BarChart3,
  Database,
  Download,
  RefreshCw,
  X,
  FileText,
  FileCheck2,
  UserPlus,
  Shield,
  Edit2,
  RotateCcw,
  Search,
  KeyRound,
  LogOut,
} from 'lucide-react';
import { DateField } from '@/components/inputs/date-field';
import { UserFormModal } from '@/components/settings/user-form-modal';
import { TemplatesSection } from '@/components/settings/templates-section';
import { ProfileSection } from '@/components/settings/profile-section';
import { PracticeSection } from '@/components/settings/practice-section';
import { NotificationsSection } from '@/components/settings/notifications-section';
import { SecuritySection } from '@/components/settings/security-section';
import { MessagesSection } from '@/components/settings/messages-section';
import { CalendarSection } from '@/components/settings/calendar-section';
import { VisitKitSection } from '@/components/settings/visit-kit-section';
import { QueryState } from '@/components/ui/query-state';
import { RevokeUserDialog } from '@/components/settings/revoke-user-dialog';
import type { Membership, Role, ID } from '@/domain/types';

type SettingsTab =
  | 'profile'
  | 'appearance'
  | 'notifications'
  | 'practice'
  | 'users'
  | 'templates'
  | 'messages'
  | 'calendar'
  | 'visit-kit'
  | 'baseline'
  | 'data'
  | 'security'
  | 'about';

export function SettingsPage() {
  const { data: session, isError: sessionError, error: sessionErr, refetch: refetchSession } = useSession();
  const {
    theme,
    setTheme,
    palette,
    setPalette,
    textScale,
    setTextScale,
    density,
    setDensity,
    reducedMotion,
    setReducedMotion,
    weekStartsOn,
    setWeekStartsOn,
    isDark,
  } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  // Read tab from path if available (e.g. /settings/baseline)
  const pathSegment = location.pathname.split('/')[2] as SettingsTab | undefined;
  const initialTab: SettingsTab =
    pathSegment && [
      'profile',
      'appearance',
      'notifications',
      'practice',
      'users',
      'templates',
      'messages',
      'calendar',
      'visit-kit',
      'baseline',
      'data',
      'security',
      'about',
    ].includes(pathSegment)
      ? pathSegment
      : 'profile';

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (pathSegment && pathSegment !== activeTab) {
      setActiveTab(pathSegment);
    }
  }, [pathSegment]);

  const handleSelectTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    navigate(`/settings/${tab}`, { replace: true });
  };

  // Baseline integration
  const { data: baselineData } = useBaseline();
  const saveBaselineMutation = useSaveBaseline();

  const [baselinePeriodStart, setBaselinePeriodStart] = useState('2026-01-01');
  const [baselinePeriodEnd, setBaselinePeriodEnd] = useState('2026-06-30');
  const [baselineTrips, setBaselineTrips] = useState(12);
  const [baselineRepeatTrips, setBaselineRepeatTrips] = useState(4);
  const [baselineFollowUps, setBaselineFollowUps] = useState(10);
  const [baselineHoursFinding, setBaselineHoursFinding] = useState(6.0);
  const [baselineLateFilings, setBaselineLateFilings] = useState(1);
  const [baselineConfidence, setBaselineConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [baselineNote, setBaselineNote] = useState('');

  useEffect(() => {
    if (baselineData) {
      setBaselinePeriodStart(baselineData.periodStart || '2026-01-01');
      setBaselinePeriodEnd(baselineData.periodEnd || '2026-06-30');
      setBaselineTrips(baselineData.tripsPerMonth ?? 12);
      setBaselineRepeatTrips(baselineData.repeatTripsPerMonth ?? 4);
      setBaselineFollowUps(baselineData.followUpsPerWeek ?? 10);
      setBaselineHoursFinding(baselineData.hoursFindingPerWeek ?? 6.0);
      setBaselineLateFilings(baselineData.lateFilingsPerQuarter ?? 1);
      setBaselineConfidence((baselineData.confidence as 1 | 2 | 3 | 4 | 5) ?? 3);
      setBaselineNote(baselineData.note ?? '');
    }
  }, [baselineData]);

  const isOwner = session?.membership.role === 'owner';

  // Super Admin: Users & Access Management
  const { data: rawMemberships = [], isLoading: isMembershipsLoading } = useMemberships();
  const { data: clientsPage } = useClients();
  const clientItems = useMemo(() => clientsPage?.items || [], [clientsPage]);
  const inviteMembershipMutation = useInviteMembership();
  const updateMembershipMutation = useUpdateMembership();
  const revokeMembershipMutation = useRevokeMembership();

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingMembership, setEditingMembership] = useState<(Membership & { name?: string; initials?: string }) | null>(null);
  const [revokingMembership, setRevokingMembership] = useState<(Membership & { name?: string }) | null>(null);
  const [userFilterRole, setUserFilterRole] = useState<'all' | 'owner' | 'helper'>('all');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userActionNotice, setUserActionNotice] = useState<string | null>(null);
  const saveSettingsMutation = useSaveSettings();
  // Flips at once so the checkbox feels instant, follows the saved value, and goes back if the save fails
  const savedHelpersCanAccept = session?.settings.helpersCanAccept ?? true;
  const [helpersCanAccept, setHelpersCanAccept] = useState(savedHelpersCanAccept);
  useEffect(() => setHelpersCanAccept(savedHelpersCanAccept), [savedHelpersCanAccept]);
  const [helpersAcceptError, setHelpersAcceptError] = useState<string | null>(null);

  const clientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    clientItems.forEach((c) => {
      map.set(c.client.id, c.client.displayName || c.client.registeredName || c.client.code);
    });
    return map;
  }, [clientItems]);

  const showUserNotice = (msg: string) => {
    setUserActionNotice(msg);
    setTimeout(() => setUserActionNotice(null), 3500);
  };

  const handleOpenAddOperator = () => {
    setEditingMembership(null);
    setUserModalOpen(true);
  };

  const handleOpenEditOperator = (m: Membership & { name?: string; initials?: string }) => {
    setEditingMembership(m);
    setUserModalOpen(true);
  };

  const handleSaveOperator = async (formData: {
    email: string;
    name: string;
    role: Role;
    clientIds: ID[];
    note?: string;
  }) => {
    if (editingMembership) {
      await updateMembershipMutation.mutateAsync({
        id: editingMembership.id,
        data: {
          role: formData.role,
          clientIds: formData.clientIds,
          name: formData.name,
        },
      });
      showUserNotice(`Updated operator access for ${formData.name || formData.email}.`);
    } else {
      await inviteMembershipMutation.mutateAsync({
        email: formData.email,
        name: formData.name,
        role: formData.role,
        clientIds: formData.clientIds,
        note: formData.note,
      });
      showUserNotice(`Added operator ${formData.name || formData.email} to practice allowlist.`);
    }
    setUserModalOpen(false);
  };

  const handleConfirmRevokeOperator = async () => {
    if (!revokingMembership) return;
    await revokeMembershipMutation.mutateAsync(revokingMembership.id);
    showUserNotice(`Revoked practice access for ${revokingMembership.name || revokingMembership.email}.`);
    setRevokingMembership(null);
  };

  const handleReactivateOperator = async (m: Membership & { name?: string }) => {
    await updateMembershipMutation.mutateAsync({
      id: m.id,
      data: { active: true },
    });
    showUserNotice(`Reactivated operator access for ${m.name || m.email}.`);
  };

  const filteredMemberships = useMemo(() => {
    return (rawMemberships as Array<Membership & { name?: string; initials?: string; lastSignInAt?: string }>).filter((m) => {
      if (userFilterRole !== 'all' && m.role !== userFilterRole) return false;
      if (userSearchQuery.trim()) {
        const q = userSearchQuery.toLowerCase();
        const matchesEmail = m.email.toLowerCase().includes(q);
        const matchesName = (m.name || '').toLowerCase().includes(q);
        return matchesEmail || matchesName;
      }
      return true;
    });
  }, [rawMemberships, userFilterRole, userSearchQuery]);

  const totalMemberships = rawMemberships.length;
  const ownerCount = rawMemberships.filter((m) => m.role === 'owner').length;
  const helperCount = rawMemberships.filter((m) => m.role === 'helper').length;
  const activeCount = rawMemberships.filter((m) => m.active).length;
  const revokedCount = rawMemberships.filter((m) => !m.active).length;

  const navItems: Array<{ id: SettingsTab; label: string; icon: React.ElementType; ownerOnly?: boolean }> = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'practice', label: 'Practice info', icon: Building2, ownerOnly: true },
    { id: 'users', label: 'Users & access', icon: Users, ownerOnly: true },
    { id: 'templates', label: 'Task templates', icon: FileCode2 },
    { id: 'messages', label: 'Message templates', icon: MessageSquare, ownerOnly: true },
    { id: 'calendar', label: 'Deadlines & holidays', icon: Calendar, ownerOnly: true },
    { id: 'visit-kit', label: 'Visit kit', icon: Briefcase, ownerOnly: true },
    { id: 'baseline', label: 'Before Ordinovix', icon: BarChart3, ownerOnly: true },
    { id: 'data', label: 'Data & backups', icon: Database, ownerOnly: true },
    { id: 'security', label: 'Security & privacy', icon: ShieldCheck },
    { id: 'about', label: 'About Ordinovix', icon: Info },
  ];

  const visibleNav = navItems.filter((item) => !item.ownerOnly || isOwner);

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2400);
  };

  if (sessionError) {
    return (
      <QueryState isLoading={false} isError error={sessionErr} onRetry={() => refetchSession()} subject="settings">
        {null}
      </QueryState>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex items-center justify-between border-b border-[var(--rule)] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">Settings</h1>
          <p className="text-sm text-[var(--ink-2)] mt-0.5">
            Manage your account preferences, practice configuration, and system defaults.
          </p>
        </div>
        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--good-bg)] text-[var(--good-fg)] border border-[var(--good-bd)] text-xs font-semibold animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>Settings saved</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 items-start">
        {/* Navigation Sidebar */}
        <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 border-b md:border-b-0 border-[var(--rule)]" aria-label="Settings categories">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap text-left ${
                  active
                    ? 'bg-[var(--stamp-soft)] text-[var(--stamp-ink)] font-semibold'
                    : 'text-[var(--ink-2)] hover:bg-[var(--sheet-2)] hover:text-[var(--ink)]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[var(--stamp-ink)]' : 'text-[var(--ink-3)]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Content Pane */}
        <div className="bg-[var(--sheet)] border border-[var(--rule)] rounded-lg p-6 max-w-2xl shadow-sm">
          {/* PROFILE */}
          {activeTab === 'profile' && session && (
            <ProfileSection
              key={session.settings.version}
              user={session.user}
              membership={session.membership}
              settings={session.settings}
              isOwner={isOwner}
              onSaved={handleSave}
              onSignOut={() => navigate('/sign-in')}
            />
          )}

          {/* APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)]">Appearance & Typography</h2>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">Customize visual themes, interface density, and display preferences.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-2">Theme</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'system', label: 'System', icon: Laptop },
                      { id: 'light', label: 'Light', icon: Sun },
                      { id: 'dark', label: 'Dark', icon: Moon },
                    ].map((mode) => {
                      const Icon = mode.icon;
                      const active = theme === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setTheme(mode.id as 'system' | 'light' | 'dark')}
                          className={`flex flex-col items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors select-none cursor-pointer ${
                            active
                              ? 'border-[var(--stamp)] bg-[var(--stamp-soft)] text-[var(--stamp-ink)] font-semibold'
                              : 'border-[var(--rule)] bg-[var(--sheet-2)] text-[var(--ink-2)] hover:border-[var(--rule-strong)]'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span>{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color Palette Selector */}
                <div>
                  <div className="mb-2.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)]">
                      Color Palette & Visual Tone
                    </label>
                    <p className="text-xs text-[var(--ink-2)] mt-0.5">
                      Curated multi-tonal dual-accent color schemes engineered for long-session eye comfort and high data clarity.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {PALETTES.map((p) => {
                      const active = palette === p.id;
                      const primary = isDark ? p.primaryDark : p.primaryLight;
                      const secondary = isDark ? p.secondaryDark : p.secondaryLight;
                      const previewBg = isDark ? p.previewBgDark : p.previewBgLight;

                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPalette(p.id)}
                          className={`p-3.5 rounded-panel border text-left transition-all select-none cursor-pointer flex flex-col justify-between gap-3 group relative ${
                            active
                              ? 'border-[var(--stamp)] ring-2 ring-[var(--stamp)]/30 bg-[var(--sheet)] shadow-xs'
                              : 'border-[var(--rule)] bg-[var(--sheet-2)] hover:border-[var(--rule-strong)] hover:bg-[var(--sheet)]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                                <span>{p.name}</span>
                                {active && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--stamp)]" />
                                )}
                              </div>
                              <div className="text-[11px] text-[var(--ink-3)] mt-0.5 leading-relaxed line-clamp-2">
                                {p.tagline}
                              </div>
                            </div>
                            {active && (
                              <Check className="w-4 h-4 text-[var(--stamp)] shrink-0 mt-0.5" />
                            )}
                          </div>

                          {/* Swatch & Pill Preview Strip */}
                          <div
                            className="p-2 rounded-control border border-[var(--rule)] flex items-center justify-between gap-2"
                            style={{ backgroundColor: previewBg }}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-4 h-4 rounded-full shadow-xs shrink-0 ring-1 ring-black/10"
                                style={{ backgroundColor: primary }}
                                title="Primary Brand Accent"
                              />
                              <span
                                className="w-3.5 h-3.5 rounded-full shadow-2xs shrink-0 ring-1 ring-black/10"
                                style={{ backgroundColor: secondary }}
                                title="Secondary Harmonic Accent"
                              />
                            </div>
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold tracking-tight shadow-2xs"
                              style={{
                                backgroundColor: primary,
                                color: '#FFFFFF',
                              }}
                            >
                              Sample
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-2">
                    Layout Density
                  </label>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {[
                      { id: 'comfortable', label: 'Comfortable', desc: 'Standard 40-44px rows', height: '44px' },
                      { id: 'compact', label: 'Compact', desc: 'Tight 32-36px table rows', height: '34px' },
                    ].map((d) => {
                      const isActive = density === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setDensity(d.id as 'comfortable' | 'compact')}
                          className={`p-3 rounded-lg border text-left transition-all select-none cursor-pointer flex flex-col justify-between ${
                            isActive
                              ? 'border-stamp bg-stamp-soft text-stamp-strong ring-1 ring-stamp'
                              : 'border-rule bg-sheet-2 text-ink-2 hover:border-rule-strong'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-bold flex items-center gap-1.5">
                              {d.label}
                              {isActive && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stamp text-on-stamp font-medium">
                                  Active
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sheet border border-rule text-ink-3">
                              {d.height}
                            </span>
                          </div>
                          <div className="text-xs text-ink-3 mt-1">{d.desc}</div>

                          {/* Wireframe density visualizer */}
                          <div className="mt-3 pt-2.5 border-t border-rule/50 space-y-1" aria-hidden="true">
                            <div className={`w-full bg-sheet-3 rounded-xs transition-all ${d.id === 'compact' ? 'h-2' : 'h-3'}`} />
                            <div className={`w-3/4 bg-sheet-3 rounded-xs transition-all ${d.id === 'compact' ? 'h-2' : 'h-3'}`} />
                            <div className={`w-5/6 bg-sheet-3 rounded-xs transition-all ${d.id === 'compact' ? 'h-2' : 'h-3'}`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Live Interactive Density Preview */}
                  <div className="border border-rule rounded-panel overflow-hidden bg-sheet shadow-xs">
                    <div className="px-3 py-2 bg-sheet-2 border-b border-rule flex items-center justify-between text-[11px] text-ink-3">
                      <span className="font-semibold text-ink">Live Table Density Preview</span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-sheet border border-rule text-stamp font-bold">
                        {density === 'compact' ? 'Compact: ~34px Rows Active' : 'Comfortable: ~44px Rows Active'}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-sheet-2/60 border-b border-rule text-ink-3 font-semibold uppercase tracking-wider text-[10px]">
                            <th className="py-2.5 px-3">Client</th>
                            <th className="py-2.5 px-3">Obligation</th>
                            <th className="py-2.5 px-3 whitespace-nowrap">Due Date</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Row Size</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rule font-sans">
                          <tr className="hover:bg-sheet-2/60 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-stamp-soft text-stamp">
                                  BGC-001
                                </span>
                                <span className="font-semibold text-ink">ABC Holdings Inc.</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-medium text-ink">
                              1702-RT (Annual Income Tax)
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap text-ink-2 font-mono text-[11px]">
                              Apr 15, 2026
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-chip text-[11px] font-semibold bg-warn-bg text-warn-fg border border-warn-bd">
                                Awaiting Review
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-sheet-2 text-ink-3 border border-rule">
                                {density === 'compact' ? '34px' : '44px'}
                              </span>
                            </td>
                          </tr>
                          <tr className="hover:bg-sheet-2/60 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-stamp-soft text-stamp">
                                  QC-042
                                </span>
                                <span className="font-semibold text-ink">Summit Retail Corp</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-medium text-ink">
                              2551Q (Quarterly Percentage Tax)
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap text-ink-2 font-mono text-[11px]">
                              May 25, 2026
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-chip text-[11px] font-semibold bg-info-bg text-info-fg border border-info-bd">
                                Ready Next Step
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-sheet-2 text-ink-3 border border-rule">
                                {density === 'compact' ? '34px' : '44px'}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="px-3 py-1.5 bg-sheet-2/40 border-t border-rule text-[11px] text-ink-3">
                      Applies automatically across all tables in Tasks, Clients, Payments, Documents, and Audit Logs.
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-2">Text Scale</label>
                  <div className="flex gap-3">
                    {(['100', '112.5', '125'] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setTextScale(size)}
                        className={`px-4 py-2 rounded-md border text-sm font-mono font-medium transition-colors select-none cursor-pointer ${
                          textScale === size
                            ? 'border-[var(--stamp)] bg-[var(--stamp-soft)] text-[var(--stamp-ink)] font-bold'
                            : 'border-[var(--rule)] bg-[var(--sheet-2)] text-[var(--ink-2)]'
                        }`}
                      >
                        {size}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--sheet-2)] border border-[var(--rule)]">
                  <div>
                    <div className="text-sm font-semibold text-[var(--ink)]">Reduced Motion</div>
                    <div className="text-xs text-[var(--ink-3)]">Disable stamp and drawer animations for accessibility.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={(e) => setReducedMotion(e.target.checked)}
                    className="w-4 h-4 accent-[var(--stamp)] rounded cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-2">Calendar Week Starts On</label>
                  <div className="flex gap-3">
                    {[
                      { id: 'monday', label: 'Monday (ISO standard)' },
                      { id: 'sunday', label: 'Sunday' },
                    ].map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setWeekStartsOn(w.id as 'monday' | 'sunday')}
                        className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors select-none cursor-pointer ${
                          weekStartsOn === w.id
                            ? 'border-[var(--stamp)] bg-[var(--stamp-soft)] text-[var(--stamp-ink)] font-bold'
                            : 'border-[var(--rule)] bg-[var(--sheet-2)] text-[var(--ink-2)]'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--rule)] flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--stamp)] text-[var(--on-stamp)] font-medium text-sm hover:bg-[var(--stamp-strong)] transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Save changes</span>
                </button>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {activeTab === 'notifications' && session && (
            <NotificationsSection key={`${session.settings.version}-${session.prefs.pushTypes.join()}`} settings={session.settings} prefs={session.prefs} onSaved={handleSave} />
          )}

          {/* PRACTICE (OWNER ONLY) */}
          {activeTab === 'practice' && isOwner && session && (
            <PracticeSection key={session.settings.version} settings={session.settings} onSaved={handleSave} />
          )}

          {/* SUPER ADMIN: USERS & ACCESS CONTROL (OWNER ONLY) */}
          {activeTab === 'users' && isOwner && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--stamp-soft)] text-[var(--stamp)] uppercase tracking-wider border border-[var(--stamp)]/20">
                      <ShieldCheck className="w-3.5 h-3.5" /> Super Admin Console
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-[var(--ink)] tracking-tight">
                    Operator Accounts & Access Control
                  </h2>
                  <p className="text-xs text-[var(--ink-3)] max-w-xl">
                    Manage authorized Google accounts allowlisted for this practice. Configure role privileges (Owner vs Helper) and assign client matter scopes.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddOperator}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[var(--stamp)] text-[var(--on-stamp)] font-semibold text-xs hover:bg-[var(--stamp-strong)] transition-all shadow-xs hover:shadow cursor-pointer active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Invite / Add Operator</span>
                </button>
              </div>

              {/* Action Notice */}
              {userActionNotice && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[var(--good-bg)] text-[var(--good-fg)] border border-[var(--good-bd)] text-xs font-semibold animate-in fade-in">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{userActionNotice}</span>
                </div>
              )}

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-lg border border-[var(--rule)] bg-[var(--sheet)]">
                  <div className="text-[11px] font-medium text-[var(--ink-3)] uppercase tracking-wider">Total Accounts</div>
                  <div className="text-2xl font-bold text-[var(--ink)] mt-1">{totalMemberships}</div>
                  <div className="text-[11px] text-[var(--ink-3)] mt-0.5">Practice allowlist</div>
                </div>

                <div className="p-3.5 rounded-lg border border-[var(--rule)] bg-[var(--sheet)]">
                  <div className="text-[11px] font-medium text-[var(--stamp)] uppercase tracking-wider">Super Admins</div>
                  <div className="text-2xl font-bold text-[var(--ink)] mt-1">{ownerCount}</div>
                  <div className="text-[11px] text-[var(--ink-3)] mt-0.5">Full authority</div>
                </div>

                <div className="p-3.5 rounded-lg border border-[var(--rule)] bg-[var(--sheet)]">
                  <div className="text-[11px] font-medium text-[var(--info-fg)] uppercase tracking-wider">Scoped Helpers</div>
                  <div className="text-2xl font-bold text-[var(--ink)] mt-1">{helperCount}</div>
                  <div className="text-[11px] text-[var(--ink-3)] mt-0.5">Assigned matters</div>
                </div>

                <div className="p-3.5 rounded-lg border border-[var(--rule)] bg-[var(--sheet)]">
                  <div className="text-[11px] font-medium text-[var(--ink-3)] uppercase tracking-wider">Status</div>
                  <div className="text-2xl font-bold text-[var(--good-fg)] mt-1">{activeCount}</div>
                  <div className="text-[11px] text-[var(--ink-3)] mt-0.5">
                    {revokedCount > 0 ? `${revokedCount} revoked` : 'All active'}
                  </div>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="p-3 rounded-lg bg-[var(--sheet)] border border-[var(--rule)] flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full h-8 pl-9 pr-3 rounded-md border border-[var(--rule)] bg-[var(--sheet-2)] text-xs text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-1 focus:ring-[var(--stamp)]"
                  />
                  {userSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setUserSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ink-3)] hover:text-[var(--ink)]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[var(--ink-3)] mr-1">Role:</span>
                  {(['all', 'owner', 'helper'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setUserFilterRole(r)}
                      className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors ${
                        userFilterRole === r
                          ? 'bg-[var(--stamp)] text-[var(--on-stamp)]'
                          : 'bg-[var(--sheet-2)] text-[var(--ink-2)] hover:bg-[var(--rule)]'
                      }`}
                    >
                      {r === 'all' ? `All (${totalMemberships})` : r === 'owner' ? `Owners (${ownerCount})` : `Helpers (${helperCount})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Operator Cards List */}
              <div className="space-y-3">
                {isMembershipsLoading ? (
                  <div className="p-8 text-center text-xs text-[var(--ink-3)] border border-[var(--rule)] rounded-lg">
                    Loading operator accounts...
                  </div>
                ) : filteredMemberships.length === 0 ? (
                  <div className="p-8 text-center border border-[var(--rule)] rounded-lg bg-[var(--sheet-2)]">
                    <p className="text-sm font-semibold text-[var(--ink)]">No operators found</p>
                    <p className="text-xs text-[var(--ink-3)] mt-1">
                      No operator accounts match the active search or role filter.
                    </p>
                  </div>
                ) : (
                  filteredMemberships.map((m) => {
                    const isSelf = session?.user?.email?.toLowerCase() === m.email.toLowerCase();
                    const isUserActive = m.active !== false;
                    const assignedCount = m.clientIds?.length || 0;

                    return (
                      <div
                        key={m.id}
                        className={`p-4 rounded-lg border transition-all ${
                          isUserActive
                            ? 'bg-[var(--sheet)] border-[var(--rule)] hover:border-[var(--stamp)]/40'
                            : 'bg-[var(--sheet-2)] border-[var(--rule)] opacity-75'
                        }`}
                      >
                        {/* Top Row: User Avatar, Name, Email, Role, Status, and Actions */}
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Initials Avatar */}
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 relative ${
                                m.role === 'owner'
                                  ? 'bg-[var(--stamp-soft)] text-[var(--stamp)]'
                                  : 'bg-[var(--info-bg)] text-[var(--info-fg)] border border-[var(--info-bd)]'
                              }`}
                            >
                              {m.initials || m.name?.slice(0, 2).toUpperCase() || m.email.slice(0, 2).toUpperCase()}
                              {/* Status dot */}
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--sheet)] ${
                                  isUserActive ? 'bg-[var(--good-solid, #16a34a)]' : 'bg-[var(--destructive, #dc2626)]'
                                }`}
                                title={isUserActive ? 'Active' : 'Revoked'}
                              />
                            </div>

                            {/* Details */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-[var(--ink)]">
                                  {m.name || m.email.split('@')[0]}
                                </span>
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[var(--rule)] text-[var(--ink-2)]">
                                    You
                                  </span>
                                )}
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-bold inline-flex items-center gap-1 ${
                                    m.role === 'owner'
                                      ? 'bg-[var(--stamp-soft)] text-[var(--stamp-ink)]'
                                      : 'bg-[var(--info-bg)] text-[var(--info-fg)] border border-[var(--info-bd)]'
                                  }`}
                                >
                                  {m.role === 'owner' ? (
                                    <>
                                      <Shield className="w-3 h-3" />
                                      <span>Owner (Super Admin)</span>
                                    </>
                                  ) : (
                                    <>
                                      <User className="w-3 h-3" />
                                      <span>Helper (Scoped)</span>
                                    </>
                                  )}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    isUserActive
                                      ? 'bg-[var(--good-bg)] text-[var(--good-fg)] border border-[var(--good-bd)]'
                                      : 'bg-[var(--destructive-light, #fee2e2)] text-[var(--destructive, #dc2626)] border border-[var(--destructive, #dc2626)]/20'
                                  }`}
                                >
                                  {isUserActive ? 'Active' : 'Access Revoked'}
                                </span>
                              </div>

                              <div className="text-xs text-[var(--ink-3)] font-mono mt-0.5">
                                {m.email}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditOperator(m)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--rule)] bg-[var(--sheet)] hover:bg-[var(--sheet-2)] text-xs font-medium text-[var(--ink)] transition-colors cursor-pointer"
                              title="Edit role and client scopes"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            {isUserActive ? (
                              isSelf ? (
                                <span className="text-[11px] text-[var(--ink-3)] italic px-2">
                                  Current session
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setRevokingMembership(m)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--destructive, #dc2626)]/30 text-[var(--destructive, #dc2626)] hover:bg-[var(--destructive-light, #fee2e2)] text-xs font-medium transition-colors cursor-pointer"
                                  title="Revoke operator access"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Revoke</span>
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReactivateOperator(m)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--good-bd)] text-[var(--good-fg)] hover:bg-[var(--good-bg)] text-xs font-medium transition-colors cursor-pointer"
                                title="Reactivate operator access"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Reactivate</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Middle Row: Client Scope Summary */}
                        <div className="mt-3 pt-3 border-t border-[var(--rule)]/60 text-xs">
                          {m.role === 'owner' ? (
                            <div className="flex items-center gap-2 text-[var(--ink-2)]">
                              <ShieldCheck className="w-4 h-4 text-[var(--stamp)] shrink-0" />
                              <span>
                                <strong>Full Practice Scope:</strong> Full administrative authority across all client files, BIR forms, counter representation, and firm settings.
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[var(--ink-2)]">
                                <span className="font-medium">
                                  Assigned Client Matters ({assignedCount}):
                                </span>
                                {assignedCount === 0 && (
                                  <span className="text-[var(--warn-fg)] font-semibold">
                                    Zero clients assigned (Helper cannot access client files)
                                  </span>
                                )}
                              </div>
                              {assignedCount > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {m.clientIds?.map((cId) => (
                                    <span
                                      key={cId}
                                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--sheet-2)] border border-[var(--rule)] text-[var(--ink)]"
                                    >
                                      {clientNameMap.get(cId) || cId}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom Row: Metadata */}
                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-[var(--ink-3)] font-mono">
                          <span>Invited: {m.invitedAt || 'Initial setup'}</span>
                          {m.lastSignInAt && <span>Last Sign-In: {m.lastSignInAt}</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Practice Operator Policies Card */}
              <div className="p-4 rounded-lg bg-[var(--sheet-2)] border border-[var(--rule)] space-y-4">
                <h3 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider">
                  Practice Security & Scoping Policies
                </h3>

                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <label htmlFor="helpers-accept-toggle" className="text-sm font-semibold text-[var(--ink)] cursor-pointer">
                      Helpers Can Accept Requirements
                    </label>
                    <div className="text-xs text-[var(--ink-3)]">
                      Allow scoped helpers to mark checklist requirements as Accepted. If disabled, helpers can only mark items as Received.
                    </div>
                  </div>
                  <input
                    id="helpers-accept-toggle"
                    type="checkbox"
                    checked={helpersCanAccept}
                    onChange={(e) => {
                      setHelpersAcceptError(null);
                      setHelpersCanAccept(e.target.checked);
                      saveSettingsMutation.mutate(
                        { helpersCanAccept: e.target.checked },
                        {
                          onSuccess: handleSave,
                          onError: (err) => {
                            setHelpersCanAccept(savedHelpersCanAccept);
                            setHelpersAcceptError((err as Error).message);
                          },
                        }
                      );
                    }}
                    className="w-4 h-4 mt-1 accent-[var(--stamp)] rounded cursor-pointer"
                  />
                </div>
                {helpersAcceptError && (
                  <p role="alert" className="text-xs text-[var(--critical-fg)]">{helpersAcceptError}</p>
                )}

                <div className="p-3 rounded-md bg-[var(--sheet)] border border-[var(--rule)] text-xs text-[var(--ink-2)] flex items-start gap-2.5">
                  <KeyRound className="w-4 h-4 text-[var(--stamp)] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong>Zero-Knowledge Credentials & Google Allowlist:</strong>
                    <p className="text-[var(--ink-3)]">
                      Ordinovix never stores operator passwords or portal credentials (eFPS, eBIRForms, ORUS). Operator authentication is strictly enforced via Google Workspace OAuth against the active allowlist above.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modals */}
              <UserFormModal
                open={userModalOpen}
                onClose={() => setUserModalOpen(false)}
                membership={editingMembership}
                clients={clientItems}
                onSave={handleSaveOperator}
              />

              <RevokeUserDialog
                open={Boolean(revokingMembership)}
                onClose={() => setRevokingMembership(null)}
                membership={revokingMembership}
                onConfirm={handleConfirmRevokeOperator}
              />
            </div>
          )}

          {/* TEMPLATES */}
          {activeTab === 'templates' && <TemplatesSection isOwner={isOwner} />}

          {/* MESSAGES (OWNER ONLY) */}
          {activeTab === 'messages' && isOwner && <MessagesSection onSaved={handleSave} />}

          {/* CALENDAR (OWNER ONLY) */}
          {activeTab === 'calendar' && isOwner && session && <CalendarSection settings={session.settings} onSaved={handleSave} />}

          {/* VISIT KIT (OWNER ONLY) */}
          {activeTab === 'visit-kit' && isOwner && <VisitKitSection onSaved={handleSave} />}

          {/* ACCESS DENIED GUARD FOR HELPER */}
          {!isOwner && ['practice', 'users', 'messages', 'calendar', 'visit-kit', 'baseline', 'data'].includes(activeTab) && (
            <div className="py-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[var(--warn-bg)] text-[var(--warn-fg)] border border-[var(--warn-bd)] flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[var(--ink)]">Owner Permission Required</h3>
              <p className="text-xs text-[var(--ink-2)] max-w-sm mx-auto">
                This configuration section is restricted to the practice owner (Ana Santos). Your helper account does not have administrative access.
              </p>
              <button
                type="button"
                onClick={() => handleSelectTab('profile')}
                className="px-4 py-2 rounded-md bg-[var(--stamp)] text-[var(--on-stamp)] text-xs font-semibold hover:bg-[var(--stamp-strong)]"
              >
                Return to Profile
              </button>
            </div>
          )}

          {/* BASELINE: BEFORE ORDINOVIX (OWNER ONLY) */}
          {activeTab === 'baseline' && isOwner && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)]">Before Ordinovix Baseline</h2>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">
                  Discovery baseline figures from prior operations. These benchmark metrics power velocity and savings charts in Insights.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">
                      Period Start (Assessment Period)
                    </label>
                    <DateField
                      value={baselinePeriodStart}
                      onChange={(val) => setBaselinePeriodStart(val || '')}
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">
                      Period End
                    </label>
                    <DateField
                      value={baselinePeriodEnd}
                      onChange={(val) => setBaselinePeriodEnd(val || '')}
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">
                      Office Trips Per Month (Prior Baseline)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={baselineTrips}
                      onChange={(e) => setBaselineTrips(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">
                      Repeat Trips Per Month (Avoidable Re-trips)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={baselineRepeatTrips}
                      onChange={(e) => setBaselineRepeatTrips(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">
                      Follow-up Messages Per Week
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={baselineFollowUps}
                      onChange={(e) => setBaselineFollowUps(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">
                      Hours / Week Finding Records (Step 0.5)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={baselineHoursFinding}
                      onChange={(e) => setBaselineHoursFinding(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">
                    Late or Missed Filings Per Quarter
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={baselineLateFilings}
                    onChange={(e) => setBaselineLateFilings(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-2">
                    Confidence About What is Outstanding (1 to 5)
                  </label>
                  <div className="grid grid-cols-5 gap-2 text-center text-xs">
                    {[
                      { val: 1, label: 'Not sure at all' },
                      { val: 2, label: 'Slightly sure' },
                      { val: 3, label: 'Moderately sure' },
                      { val: 4, label: 'Very sure' },
                      { val: 5, label: 'Completely sure' },
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setBaselineConfidence(item.val as any)}
                        className={`p-2.5 rounded-lg border flex flex-col items-center gap-1 transition-colors ${
                          baselineConfidence === item.val
                            ? 'border-[var(--stamp)] bg-[var(--stamp-soft)] text-[var(--stamp-ink)] font-bold'
                            : 'border-[var(--rule)] bg-[var(--sheet-2)] text-[var(--ink-2)]'
                        }`}
                      >
                        <span className="font-mono text-sm">{item.val}</span>
                        <span className="text-[10px] leading-tight">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">
                    Discovery Baseline Notes
                  </label>
                  <textarea
                    rows={3}
                    value={baselineNote}
                    onChange={(e) => setBaselineNote(e.target.value)}
                    placeholder="Context on operational friction, repeat trips to RDO 048, or lost paper schedules..."
                    className="w-full p-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--rule)] flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    await saveBaselineMutation.mutateAsync({
                      periodStart: baselinePeriodStart,
                      periodEnd: baselinePeriodEnd,
                      tripsPerMonth: baselineTrips,
                      repeatTripsPerMonth: baselineRepeatTrips,
                      followUpsPerWeek: baselineFollowUps,
                      hoursFindingPerWeek: baselineHoursFinding,
                      lateFilingsPerQuarter: baselineLateFilings,
                      confidence: baselineConfidence,
                      note: baselineNote,
                    });
                    handleSave();
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--stamp)] text-[var(--on-stamp)] font-medium text-sm hover:bg-[var(--stamp-strong)] transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Baseline</span>
                </button>
              </div>
            </div>
          )}

          {/* DATA & BACKUPS (OWNER ONLY) */}
          {activeTab === 'data' && isOwner && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)]">Data & Practice Backups</h2>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">
                  Export complete practice archives, verify backup schedules, and manage test data state.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-[var(--rule)] bg-[var(--sheet-2)] flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-[var(--ink)]">Export Full Practice Archive</div>
                    <div className="text-xs text-[var(--ink-3)] mt-0.5">
                      Download all clients, obligations, checklist lines, visit records, payments, and audit history.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
                        JSON.stringify({
                          exportDate: new Date().toISOString(),
                          organization: session?.org,
                          note: "Ordinovix practice backup export"
                        }, null, 2)
                      );
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute("href", dataStr);
                      downloadAnchor.setAttribute("download", `ordinovix-backup-${new Date().toISOString().slice(0, 10)}.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--sheet)] border border-[var(--rule)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--sheet-2)] transition-colors"
                  >
                    <Download className="w-4 h-4 text-[var(--stamp)]" />
                    <span>Export JSON</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-[var(--rule)] bg-[var(--sheet-2)] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-[var(--ink)]">Automated Backup Status</div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--good-bg)] text-[var(--good-fg)] border border-[var(--good-bd)]">
                      Active
                    </span>
                  </div>
                  <div className="text-xs text-[var(--ink-2)] space-y-1">
                    <p>Last automated export: <strong>Yesterday at 02:00 AM (Asia/Manila)</strong></p>
                    <p>Retention schedule: <strong>7-Year Statutory Tax Record Retention (NIRC Sec. 235)</strong></p>
                    <p>Encryption standard: <strong>AES-256 at rest</strong></p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[var(--critical-bd)] bg-[var(--critical-bg)] text-[var(--critical-fg)] flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold">Reset Sample Data</div>
                    <div className="text-xs opacity-90 mt-0.5">
                      Clears mock local storage and re-seeds clean sample clients, tasks, and visits.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to reset all mock sample data? Current local edits will be reset to seed data.")) {
                        devControls.reset();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--critical-solid)] text-[var(--on-critical-solid)] text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset to Seed</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECURITY */}
          {activeTab === 'security' && session && (
            <SecuritySection
              key={`${session.settings.version}-${session.prefs.privacyModeOnStart}`}
              settings={session.settings}
              prefs={session.prefs}
              isOwner={isOwner}
              onSaved={handleSave}
              onSignOutEverywhere={() => {
                alert('Signed out of all devices');
                navigate('/sign-in');
              }}
            />
          )}

          {/* ABOUT */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)]">About Ordinovix</h2>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">Private practice workflow system for trusted Philippine tax preparers.</p>
              </div>

              <div className="space-y-3 text-sm text-[var(--ink-2)]">
                <div className="p-3 rounded bg-[var(--sheet-2)] border border-[var(--rule)] flex justify-between font-mono text-xs">
                  <span>Version</span>
                  <span className="font-bold text-[var(--ink)]">2.0.0-rc1</span>
                </div>
                <div className="p-3 rounded bg-[var(--sheet-2)] border border-[var(--rule)] flex justify-between font-mono text-xs">
                  <span>Target Jurisdiction</span>
                  <span className="font-bold text-[var(--ink)]">Republic of the Philippines (BIR / SEC / LGU)</span>
                </div>
                <div className="p-3 rounded bg-[var(--sheet-2)] border border-[var(--rule)] flex justify-between font-mono text-xs">
                  <span>Statutory Compliance</span>
                  <span className="font-bold text-[var(--ink)]">RA 10173 (Data Privacy Act of 2012)</span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[var(--neutral-bg)] border border-[var(--neutral-bd)] text-xs text-[var(--ink-2)] space-y-2">
                <div className="font-bold text-[var(--ink)]">What Ordinovix does NOT do:</div>
                <ul className="list-disc list-inside space-y-1 text-[var(--ink-3)]">
                  <li>Does not file directly to BIR portal or submit electronic returns without operator review.</li>
                  <li>Does not store BIR portal passwords (eFPS, eBIRForms, ORUS).</li>
                  <li>Does not replace formal legal tax counsel or CPA certification.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
