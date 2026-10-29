import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QuerySkeleton } from './query-state';

describe('U39 the loading skeleton', () => {
  it('has a role, because axe forbids aria-label on a plain div (aria-prohibited-attr, seen on /audit while it loads)', () => {
    const html = renderToString(<QuerySkeleton />);
    expect(html).toContain('aria-label="Loading"');
    expect(html).toContain('role="status"');
  });
});
