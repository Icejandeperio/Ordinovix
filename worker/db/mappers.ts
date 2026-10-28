/**
 * Rows to the entities the screens use (src/domain/types.ts). The inverse of what worker/db/seed.ts writes. Derived values
 * (displayed status, due state, readiness) are not here: they are computed with src/domain/rules.ts when a route needs them.
 */
import type { Membership, Org, OrgSettings, User, UserPrefs } from '@/domain/types';
import type * as schema from './schema';

type OrgRow = typeof schema.orgs.$inferSelect;
type SettingsRow = typeof schema.orgSettings.$inferSelect;
type UserRow = typeof schema.users.$inferSelect;
type PrefsRow = typeof schema.userPrefs.$inferSelect;
type MembershipRow = typeof schema.memberships.$inferSelect;

const omitNull = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T;

export function rowToOrg(row: OrgRow): Org {
  return { id: row.id, name: row.name, isDemo: row.isDemo, createdAt: row.createdAt };
}

export function rowToUser(row: UserRow): User {
  return omitNull({
    id: row.id,
    name: row.name,
    displayName: row.displayName ?? undefined,
    email: row.email,
    initials: row.initials,
    mobileE164: row.mobileE164 ?? undefined,
    lastSignInAt: row.lastSignInAt ?? undefined,
  }) as User;
}

export function rowToSettings(row: SettingsRow): OrgSettings {
  return omitNull({
    orgId: row.orgId,
    practiceName: row.practiceName,
    operatorDisplayName: row.operatorDisplayName,
    mobileE164: row.mobileE164 ?? undefined,
    accreditation: row.accreditationNumber
      ? omitNull({ number: row.accreditationNumber, validUntil: row.accreditationValidUntil ?? undefined })
      : undefined,
    dueSoonDays: row.dueSoonDays,
    followUpWaitDays: row.followUpWaitDays,
    authWarnDays: row.authWarnDays,
    helpersCanAccept: row.helpersCanAccept,
    idleLockMinutes: row.idleLockMinutes as OrgSettings['idleLockMinutes'],
    quietHours: { start: row.quietHoursStart, end: row.quietHoursEnd },
    digestTime: row.digestTime,
    paperSize: row.paperSize as OrgSettings['paperSize'],
    weekStartsOn: row.weekStartsOn as OrgSettings['weekStartsOn'],
    retentionYears: row.retentionYears,
    supportContact: row.supportContact ?? undefined,
    // undefined until the owner starts the first-run setup, like the mock
    onboarding: row.onboardingDone.length > 0 || row.onboardingDismissed ? omitNull({ done: row.onboardingDone as never, dismissed: row.onboardingDismissed || undefined }) : undefined,
    updatedAt: row.updatedAt,
    version: row.version,
  }) as OrgSettings;
}

/** A person with no saved preferences gets these (the same defaults as a new account in the mock). */
export function defaultPrefs(userId: string): UserPrefs {
  return {
    userId,
    theme: 'system',
    density: 'comfortable',
    textScale: 1,
    reduceMotion: null,
    dateOrder: 'mdy',
    privacyModeOnStart: false,
    todayScope: 'mine',
    pushTypes: [],
    tableColumns: {},
  };
}

export function rowToPrefs(row: PrefsRow): UserPrefs {
  return {
    userId: row.userId,
    theme: row.theme as UserPrefs['theme'],
    density: row.density as UserPrefs['density'],
    textScale: row.textScale as UserPrefs['textScale'],
    reduceMotion: row.reduceMotion ?? null,
    dateOrder: row.dateOrder as UserPrefs['dateOrder'],
    privacyModeOnStart: row.privacyModeOnStart,
    todayScope: row.todayScope as UserPrefs['todayScope'],
    pushTypes: row.pushTypes as UserPrefs['pushTypes'],
    tableColumns: row.tableColumns,
  };
}

export function rowToMembership(row: MembershipRow, clientIds: string[]): Membership {
  return omitNull({
    id: row.id,
    orgId: row.orgId,
    email: row.email,
    userId: row.userId ?? undefined,
    role: row.role as Membership['role'],
    clientIds: row.role === 'owner' ? [] : clientIds,
    active: row.active,
    invitedAt: row.invitedAt,
    acceptedAt: row.acceptedAt ?? undefined,
    revokedAt: row.revokedAt ?? undefined,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    version: row.version,
    deletedAt: row.deletedAt ?? undefined,
    deletedReason: row.deletedReason ?? undefined,
  }) as Membership;
}
