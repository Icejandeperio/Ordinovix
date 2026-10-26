import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession, useBaseline, useSaveBaseline } from '@/hooks/useData';
import { devControls } from '@/data';
import { useTheme } from '@/app/theme';
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
} from 'lucide-react';
import { DateField } from '@/components/inputs/date-field';

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
  const { data: session } = useSession();
  const {
    theme,
    setTheme,
    textScale,
    setTextScale,
    density,
    setDensity,
    reducedMotion,
    setReducedMotion,
    weekStartsOn,
    setWeekStartsOn,
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

  // Template verification modal state
  const [verifyTemplateCode, setVerifyTemplateCode] = useState<string | null>(null);
  const [verifySourceRef, setVerifySourceRef] = useState('');
  const [verifySourceLink, setVerifySourceLink] = useState('');
  const [verifyDate, setVerifyDate] = useState('2026-10-25');
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Template list state
  const [templatesList, setTemplatesList] = useState([
    { code: '1601-EQ', name: 'Quarterly Creditable Withholding Tax', freq: 'Quarterly', verified: true, lines: 4, sourceRef: 'NIRC Sec. 58 / RR 2-98' },
    { code: '0619-E', name: 'Monthly Remittance of Creditable Withholding Tax', freq: 'Monthly', verified: true, lines: 3, sourceRef: 'NIRC Sec. 58 / RR 11-2018' },
    { code: '1702-Q', name: 'Quarterly Corporate Income Tax', freq: 'Quarterly', verified: true, lines: 5, sourceRef: 'NIRC Sec. 75 / CREATE Act' },
    { code: '2551-Q', name: 'Quarterly Percentage Tax Return', freq: 'Quarterly', verified: false, lines: 3, sourceRef: '' },
    { code: 'BOOK-STAMP', name: 'Annual Books of Accounts Inscription & Stamping', freq: 'Annual', verified: true, lines: 6, sourceRef: 'RMC 29-2019 / RMC 3-2023' },
  ]);

  // Profile state
  const [name, setName] = useState(session?.user.name ?? 'Ana Santos');
  const [displayName, setDisplayName] = useState('Ana S.');
  const [phone, setPhone] = useState(session?.user.mobileE164 ?? '+63 917 555 0101');
  const [initials, setInitials] = useState(session?.user.initials ?? 'AS');


  // Practice state
  const [practiceName, setPracticeName] = useState(session?.settings.practiceName ?? session?.org.name ?? 'Santos Tax Advisory Services');
  const [tin, setTin] = useState('123-456-789-000');
  const [accreditationNo, setAccreditationNo] = useState('BIR-TA-2024-009182');
  const [accreditationExpiry, setAccreditationExpiry] = useState('2027-12-31');

  // Security state
  const [idleLock, setIdleLock] = useState<'off' | '5' | '15' | '30'>('15');
  const [privacyOnStart, setPrivacyOnStart] = useState(false);

  const isOwner = session?.membership.role === 'owner';

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
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)]">Operator Profile</h2>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">Your personal credentials and display identity in client correspondence.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">Display Name (in messages)</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">Initials (Stamp)</label>
                    <input
                      type="text"
                      value={initials}
                      onChange={(e) => setInitials(e.target.value)}
                      maxLength={3}
                      className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">Mobile Number (PH)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">Role & Authority</label>
                  <div className="p-3 rounded-md bg-[var(--sheet-2)] border border-[var(--rule)] text-xs text-[var(--ink-2)] flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-[var(--ink)] uppercase">{session?.membership.role}</span>
                      <p className="text-[11px] text-[var(--ink-3)] mt-0.5">
                        {isOwner ? 'Full administrative authority and unmasked data view.' : 'Scoped strictly to assigned client matters.'}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--info-bg)] text-[var(--info-fg)] border border-[var(--info-bd)] uppercase">
                      Active
                    </span>
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

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-2">Layout Density</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'comfortable', label: 'Comfortable', desc: 'Standard 40-44px rows' },
                      { id: 'compact', label: 'Compact', desc: 'Tight 32-36px table rows' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDensity(d.id as 'comfortable' | 'compact')}
                        className={`p-3 rounded-lg border text-left transition-colors select-none cursor-pointer ${
                          density === d.id
                            ? 'border-[var(--stamp)] bg-[var(--stamp-soft)] text-[var(--stamp-ink)]'
                            : 'border-[var(--rule)] bg-[var(--sheet-2)] text-[var(--ink-2)]'
                        }`}
                      >
                        <div className="text-sm font-bold">{d.label}</div>
                        <div className="text-xs text-[var(--ink-3)] mt-0.5">{d.desc}</div>
                      </button>
                    ))}
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
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)]">Notification Preferences</h2>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">Control browser notifications, alert frequencies, and quiet hours.</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-[var(--sheet-2)] border border-[var(--rule)] flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-[var(--ink)]">Browser Push Alerts</div>
                    <div className="text-xs text-[var(--ink-3)]">Receive critical deadline alerts even when the tab is closed.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => alert('Push permissions mock activated')}
                    className="px-3 py-1.5 rounded-md border border-[var(--rule-strong)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--sheet-3)] transition-colors"
                  >
                    Enable Push
                  </button>
                </div>

                <div className="space-y-3">
                  {[
                    { label: 'Deadlines due within 3 days', checked: true },
                    { label: 'Authorizations expiring in 30 days', checked: true },
                    { label: 'Client uploaded a missing document', checked: true },
                    { label: 'Visit trip readiness updates', checked: false },
                    { label: 'Daily 7:00 AM dispatch summary', checked: true },
                  ].map((item, idx) => (
                    <label key={idx} className="flex items-center justify-between p-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] hover:bg-[var(--sheet-2)] cursor-pointer">
                      <span className="text-sm text-[var(--ink)]">{item.label}</span>
                      <input type="checkbox" defaultChecked={item.checked} className="w-4 h-4 accent-[var(--stamp)] rounded" />
                    </label>
                  ))}
                </div>

                <div className="p-3 rounded-md bg-[var(--sheet-2)] border border-[var(--rule)]">
                  <div className="text-xs font-bold text-[var(--ink)] mb-1">Quiet Hours</div>
                  <div className="text-xs text-[var(--ink-3)]">No notification sounds or badges between 8:00 PM and 7:00 AM (Asia/Manila).</div>
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

          {/* PRACTICE (OWNER ONLY) */}
          {activeTab === 'practice' && isOwner && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)]">Practice Configuration</h2>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">Firm accreditation details, default tax operator credentials, and stationery defaults.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">Practice Firm Name</label>
                  <input
                    type="text"
                    value={practiceName}
                    onChange={(e) => setPracticeName(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">Practice TIN</label>
                    <input
                      type="text"
                      value={tin}
                      onChange={(e) => setTin(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">BIR Tax Agent Accreditation No.</label>
                    <input
                      type="text"
                      value={accreditationNo}
                      onChange={(e) => setAccreditationNo(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                    />
                  </div>
                </div>

                <DateField
                  label="Accreditation Validity Date"
                  value={accreditationExpiry}
                  onChange={(val) => setAccreditationExpiry(val || '')}
                  showRelativeHint={true}
                />

                <div className="p-3 rounded-md bg-[var(--info-bg)] border border-[var(--info-bd)] text-xs text-[var(--info-fg)]">
                  <strong>Accreditation Reminder:</strong> Ordinovix generates automated warning banners 60 days prior to accreditation expiry to prevent interruption of counter representation privileges.
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

          {/* USERS & ACCESS (OWNER ONLY) */}
          {activeTab === 'users' && isOwner && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)]">Users & Access Control</h2>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">Manage operator allowlist and client assignment scopes.</p>
              </div>

              <div className="divide-y divide-[var(--rule)] border border-[var(--rule)] rounded-lg overflow-hidden">
                <div className="p-4 bg-[var(--sheet-2)] flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-[var(--ink)]">Ana Santos (You)</div>
                    <div className="text-xs text-[var(--ink-3)] font-mono">ana@ordinovix.ph</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-[var(--stamp-soft)] text-[var(--stamp-ink)]">
                    Owner (Full Access)
                  </span>
                </div>

                <div className="p-4 bg-[var(--sheet)] flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-[var(--ink)]">Ben Morales</div>
                    <div className="text-xs text-[var(--ink-3)] font-mono">ben@ordinovix.ph</div>
                    <div className="text-[11px] text-[var(--ink-2)] mt-1">
                      Assigned clients: <span className="font-semibold text-[var(--stamp)]">RSP Law Firm, Cruz Litigation</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-[var(--info-bg)] text-[var(--info-fg)] border border-[var(--info-bd)]">
                    Helper (Scoped)
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[var(--sheet-2)] border border-[var(--rule)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[var(--ink)]">Helpers Can Accept Lines</div>
                    <div className="text-xs text-[var(--ink-3)]">Allow helpers to mark requirements as Accepted. If disabled, they can only mark Received.</div>
                  </div>
                  <input type="checkbox" defaultChecked={true} className="w-4 h-4 accent-[var(--stamp)] rounded" />
                </div>
              </div>
            </div>
          )}

          {/* TEMPLATES */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-[var(--ink)]">Obligation Templates</h2>
                  <p className="text-xs text-[var(--ink-3)] mt-0.5">Standard obligation requirement checklists and schedule rules.</p>
                </div>
                {!isOwner && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--neutral-bg)] text-[var(--neutral-fg)] border border-[var(--neutral-bd)] uppercase">
                    Read-only (Helper)
                  </span>
                )}
              </div>

              {!isOwner && (
                <div className="p-3 bg-[var(--sheet-2)] border border-[var(--rule)] rounded-lg text-xs text-[var(--ink-2)]">
                  You are viewing templates with helper permissions. Only the practice owner can edit requirement lines or certify statutory verification.
                </div>
              )}

              <div className="space-y-3">
                {templatesList.map((t) => (
                  <div key={t.code} className="p-3.5 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[var(--neutral-bg)] text-[var(--neutral-fg)] border border-[var(--neutral-bd)]">
                          {t.code}
                        </span>
                        <span className="text-sm font-semibold text-[var(--ink)]">{t.name}</span>
                      </div>
                      <div className="text-xs text-[var(--ink-3)] flex items-center gap-2">
                        <span>{t.freq} schedule · {t.lines} requirement lines</span>
                        {t.sourceRef && (
                          <span className="font-mono text-[11px] text-[var(--ink-2)]">
                            &middot; Ref: {t.sourceRef}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {t.verified ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--good-fg)] bg-[var(--good-bg)] px-2.5 py-1 rounded border border-[var(--good-bd)]">
                          <Check className="w-3 h-3" /> Verified
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--warn-fg)] bg-[var(--warn-bg)] px-2.5 py-1 rounded border border-[var(--warn-bd)]">
                            <AlertTriangle className="w-3 h-3" /> Unverified
                          </span>
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => {
                                setVerifyTemplateCode(t.code);
                                setVerifySourceRef('');
                                setVerifySourceLink('');
                                setVerifyError(null);
                              }}
                              className="px-2.5 py-1 rounded bg-[var(--stamp)] text-[var(--on-stamp)] text-xs font-semibold hover:bg-[var(--stamp-strong)] transition-colors"
                            >
                              Mark Verified
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Template Verification Dialog */}
              {verifyTemplateCode && isOwner && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-[var(--sheet)] border border-[var(--rule)] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="w-5 h-5 text-[var(--stamp)]" />
                        <h3 className="text-sm font-bold text-[var(--ink)]">
                          Certify Template Verification ({verifyTemplateCode})
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVerifyTemplateCode(null)}
                        className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink)]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <p className="text-[var(--ink-2)]">
                        Section 12.10 requires a statutory or circular reference before any obligation template can be marked verified.
                      </p>

                      <div>
                        <label className="block font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                          Source Reference (Required) *
                        </label>
                        <input
                          type="text"
                          value={verifySourceRef}
                          onChange={(e) => {
                            setVerifySourceRef(e.target.value);
                            if (verifyError) setVerifyError(null);
                          }}
                          placeholder="e.g. NIRC Sec. 116 / RR 8-2018"
                          className="w-full h-9 px-3 rounded border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-xs focus:ring-2 focus:ring-[var(--stamp)] focus:outline-none"
                        />
                        {verifyError && (
                          <p className="text-[var(--critical-fg)] text-[11px] mt-1">{verifyError}</p>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                          Source Link (Optional)
                        </label>
                        <input
                          type="url"
                          value={verifySourceLink}
                          onChange={(e) => setVerifySourceLink(e.target.value)}
                          placeholder="https://www.bir.gov.ph/revenue-regulations/..."
                          className="w-full h-9 px-3 rounded border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-xs focus:ring-2 focus:ring-[var(--stamp)] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                          Verified Date
                        </label>
                        <DateField value={verifyDate} onChange={(val) => setVerifyDate(val || '')} placeholder="YYYY-MM-DD" />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setVerifyTemplateCode(null)}
                        className="px-3 py-1.5 rounded border border-[var(--rule)] bg-[var(--sheet)] text-xs font-medium text-[var(--ink-2)] hover:bg-[var(--sheet-2)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!verifySourceRef.trim()) {
                            setVerifyError('Statutory source reference is required to certify template.');
                            return;
                          }
                          setTemplatesList((prev) =>
                            prev.map((item) =>
                              item.code === verifyTemplateCode
                                ? { ...item, verified: true, sourceRef: verifySourceRef.trim() }
                                : item
                            )
                          );
                          setVerifyTemplateCode(null);
                          handleSave();
                        }}
                        className="px-3 py-1.5 rounded bg-[var(--stamp)] text-[var(--on-stamp)] text-xs font-semibold hover:bg-[var(--stamp-strong)]"
                      >
                        Confirm Verification
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MESSAGES (OWNER ONLY) */}
          {activeTab === 'messages' && isOwner && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)]">Message Templates</h2>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">Pre-composed messages for Viber and WhatsApp follow-ups with variable chips.</p>
              </div>

              <div className="space-y-4">
                <div className="p-3.5 rounded-lg border border-[var(--rule)] bg-[var(--sheet-2)]">
                  <div className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider mb-2">Request Missing Items (English)</div>
                  <pre className="text-xs text-[var(--ink-2)] bg-[var(--sheet)] p-3 rounded border border-[var(--rule)] font-mono whitespace-pre-wrap leading-relaxed">
{`Good day {contact_name},

This is {operator_name} following up on {task_title} for {client_name}.
We are currently missing:
{missing_items_bulleted}

Kindly send these at your earliest convenience so we can beat the deadline on {due_date}. Thank you!`}
                  </pre>
                </div>

                <div className="p-3.5 rounded-lg border border-[var(--rule)] bg-[var(--sheet-2)]">
                  <div className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider mb-2">Request Missing Items (Taglish / Filipino)</div>
                  <pre className="text-xs text-[var(--ink-2)] bg-[var(--sheet)] p-3 rounded border border-[var(--rule)] font-mono whitespace-pre-wrap leading-relaxed">
{`Magandang araw po {contact_name},

Follow up lang po mula sa tax preparation ng {client_name}.
Kailangan pa po natin ng:
{missing_items_bulleted}

Paki-send po bago mag-{due_date} para ma-process agad. Salamat po!`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* CALENDAR (OWNER ONLY) */}
          {activeTab === 'calendar' && isOwner && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)]">Deadlines & Statutory Holidays</h2>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">Statutory holiday rules and deadline move parameters.</p>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-bold text-[var(--ink-3)] uppercase tracking-wider">Default Thresholds</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded border border-[var(--rule)] bg-[var(--sheet-2)]">
                    <div className="text-xs text-[var(--ink-3)]">Due-soon Window</div>
                    <div className="text-lg font-bold text-[var(--ink)] mt-1">7 Days</div>
                  </div>
                  <div className="p-3 rounded border border-[var(--rule)] bg-[var(--sheet-2)]">
                    <div className="text-xs text-[var(--ink-3)]">Follow-up Chasing Interval</div>
                    <div className="text-lg font-bold text-[var(--ink)] mt-1">3 Days</div>
                  </div>
                  <div className="p-3 rounded border border-[var(--rule)] bg-[var(--sheet-2)]">
                    <div className="text-xs text-[var(--ink-3)]">Authorization Expiry Warning</div>
                    <div className="text-lg font-bold text-[var(--ink)] mt-1">30 Days</div>
                  </div>
                  <div className="p-3 rounded border border-[var(--rule)] bg-[var(--sheet-2)]">
                    <div className="text-xs text-[var(--ink-3)]">Timezone Standard</div>
                    <div className="text-sm font-bold text-[var(--ink)] font-mono mt-1">Asia/Manila (UTC+8)</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VISIT KIT (OWNER ONLY) */}
          {activeTab === 'visit-kit' && isOwner && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)]">Standard Visit Kit</h2>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">Items automatically included on every field trip pack list.</p>
              </div>

              <div className="space-y-2">
                {[
                  'Operator Valid Government ID (2 originals: PRC ID, Passport/Driver License)',
                  'BIR Tax Agent ID & Certificate of Accreditation photocopy',
                  'Client SPA / Authorization Letters (original with wet signatures)',
                  'Black ballpoint pens (0.5mm) & document fastener clips',
                  'Official Documentary Stamp Taxes (DST) loose stamps',
                  'Long and short document plastic envelopes with zip locks',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded border border-[var(--rule)] bg-[var(--sheet)] text-sm text-[var(--ink)]">
                    <Check className="w-4 h-4 text-[var(--good-solid)] shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)]">Security & Session Privacy</h2>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">Enforce idle lock timers and protect sensitive client taxpayer records.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-2">Idle Lock Timeout</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'off', label: 'Off' },
                      { id: '5', label: '5 min' },
                      { id: '15', label: '15 min (Recommended)' },
                      { id: '30', label: '30 min' },
                    ].map((lock) => (
                      <button
                        key={lock.id}
                        type="button"
                        onClick={() => setIdleLock(lock.id as any)}
                        className={`p-2.5 rounded-md border text-center text-xs font-medium transition-colors ${
                          idleLock === lock.id
                            ? 'border-[var(--stamp)] bg-[var(--stamp-soft)] text-[var(--stamp-ink)] font-bold'
                            : 'border-[var(--rule)] bg-[var(--sheet-2)] text-[var(--ink-2)]'
                        }`}
                      >
                        {lock.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-[var(--sheet-2)] border border-[var(--rule)]">
                  <div>
                    <div className="text-sm font-semibold text-[var(--ink)]">Privacy Mode on Startup</div>
                    <div className="text-xs text-[var(--ink-3)]">Mask all Taxpayer Identification Numbers (TINs) and revenue figures by default.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={privacyOnStart}
                    onChange={(e) => setPrivacyOnStart(e.target.checked)}
                    className="w-4 h-4 accent-[var(--stamp)] rounded cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-lg bg-[var(--critical-bg)] border border-[var(--critical-bd)] text-[var(--critical-fg)] flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold">Sign Out Everywhere</div>
                    <div className="text-xs opacity-90">Invalidates all cached browser tokens and active sessions.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => alert('Signed out of all devices')}
                    className="px-3 py-1.5 rounded-md bg-[var(--critical-solid)] text-[var(--on-critical-solid)] text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    Sign Out All
                  </button>
                </div>
              </div>
            </div>
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
