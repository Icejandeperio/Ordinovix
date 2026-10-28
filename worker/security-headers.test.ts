import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SECURITY_HEADERS } from './security-headers';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/** Parses the `/*` block of a Cloudflare `_headers` file into name/value pairs. */
function parseHeadersFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  let inAll = false;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      inAll = line.trim() === '/*';
      continue;
    }
    if (!inAll) continue;
    const idx = line.indexOf(':');
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

const CRLF = /\r\n/g;

describe('security headers on the SPA HTML (public/_headers)', () => {
  it('match the headers the Worker puts on every API response, so the app shell and the API agree', () => {
    expect(parseHeadersFile(read('../public/_headers'))).toEqual(SECURITY_HEADERS);
  });

  it('allow the inline theme script in index.html by hash, and no other inline script', () => {
    const html = read('../index.html');
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(inline.length).toBeGreaterThan(0);
    const csp = SECURITY_HEADERS['Content-Security-Policy'];
    const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src '))!;
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');
    for (const body of inline) {
      // The deployed file is built from a Linux checkout (LF); a Windows checkout may carry CRLF, so hash the LF form
      const hash = createHash('sha256').update(body.replace(CRLF, '\n')).digest('base64');
      expect(scriptSrc, 'hash of an inline script in index.html').toContain(`'sha256-${hash}'`);
    }
  });
});
