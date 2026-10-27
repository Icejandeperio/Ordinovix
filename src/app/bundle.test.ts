import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('first-load bundle (B26, B27)', () => {
  const router = read('./router.tsx');

  it('only Today and the error page are imported statically from the routes', () => {
    const staticRouteImports = [...router.matchAll(/^import \{ (\w+) \} from '@\/routes\/[^']+';$/gm)].map((m) => m[1]);
    expect(staticRouteImports.sort()).toEqual(['RouteErrorPage', 'TodayPage']);
  });

  it('every other route is lazy-loaded and rendered inside Suspense', () => {
    const lazyRoutes = [...router.matchAll(/^const (\w+) = lazy\(/gm)].map((m) => m[1]);
    expect(lazyRoutes.length).toBeGreaterThanOrEqual(25);
    for (const name of lazyRoutes) {
      expect(router, `${name} is used outside RouteSuspense`).not.toMatch(new RegExp(`element: <${name} />`));
      expect(router, `${name} is never rendered`).toMatch(new RegExp(`<RouteSuspense><${name} /></RouteSuspense>`));
    }
  });

  it('the mock data layer is not imported statically by the app', () => {
    expect(read('../data/index.ts')).not.toMatch(/^import .* from '\.\/mock';/m);
  });

  it('packages nothing imports are not dependencies', () => {
    const pkg = JSON.parse(read('../../package.json')) as { dependencies: Record<string, string> };
    for (const name of ['recharts', 'react-hook-form', '@hookform/resolvers', '@tanstack/react-table', '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities', 'react-day-picker', 'vaul']) {
      expect(pkg.dependencies, name).not.toHaveProperty(name);
    }
  });
});
