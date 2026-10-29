/** Who the shell shows as signed in. In mock mode that is the persona the dev tools chose; against the API it is the server session. */
export interface Viewer {
  role: 'owner' | 'helper';
  name: string;
  initials: string;
  /** The line under the name in the sidebar. */
  subtitle: string;
}

interface SessionLike {
  user: { name: string; initials: string };
  membership: { role: 'owner' | 'helper' };
}

const SUBTITLE = { owner: 'Preparer / Owner', helper: 'Helper Account' } as const;

export function deriveViewer(o: { mock: boolean; persona: 'owner' | 'helper'; session?: SessionLike }): Viewer {
  if (o.mock) {
    return o.persona === 'owner'
      ? { role: 'owner', name: 'Ana Santos', initials: 'AS', subtitle: SUBTITLE.owner }
      : { role: 'helper', name: 'Ben Morales', initials: 'BM', subtitle: SUBTITLE.helper };
  }
  // Against the API the saved persona is ignored. Until the session is known the person has the least access.
  if (!o.session) return { role: 'helper', name: '', initials: '', subtitle: SUBTITLE.helper };
  const role = o.session.membership.role;
  return { role, name: o.session.user.name, initials: o.session.user.initials, subtitle: SUBTITLE[role] };
}
