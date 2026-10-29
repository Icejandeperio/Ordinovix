import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/** U34: public/push-sw.js, imported by the generated service worker (workbox importScripts), runs here against a fake worker scope. */
const source = readFileSync(new URL('../../public/push-sw.js', import.meta.url), 'utf8');

interface FakeClient {
  url: string;
  focus: ReturnType<typeof vi.fn>;
  navigate?: ReturnType<typeof vi.fn>;
}

function load(windows: FakeClient[] = []) {
  const listeners: Record<string, (e: unknown) => void> = {};
  const shown: Array<{ title: string; options: Record<string, unknown> }> = [];
  const opened: string[] = [];
  const self = {
    location: { origin: 'https://app.test' },
    addEventListener: (type: string, fn: (e: unknown) => void) => void (listeners[type] = fn),
    registration: { showNotification: vi.fn(async (title: string, options: Record<string, unknown>) => void shown.push({ title, options })) },
    clients: {
      matchAll: vi.fn(async () => windows),
      openWindow: vi.fn(async (url: string) => void opened.push(url)),
    },
  };
  vm.runInNewContext(source, { self, URL, JSON, Promise });
  const waits: Promise<unknown>[] = [];
  const event = (extra: Record<string, unknown>) => ({ waitUntil: (p: Promise<unknown>) => waits.push(p), ...extra });
  return {
    shown,
    opened,
    self,
    push: async (data: unknown) => {
      listeners.push(event({ data: data === undefined ? null : { json: () => (typeof data === 'string' ? JSON.parse(data) : data), text: () => String(data) } }));
      await Promise.all(waits);
    },
    click: async (url: string | undefined) => {
      const close = vi.fn();
      listeners.notificationclick(event({ notification: { close, data: url === undefined ? undefined : { url } } }));
      await Promise.all(waits);
      return close;
    },
  };
}

describe('U34 service worker: a pushed notification', () => {
  it('shows the text it was sent, which the Worker built from client and task codes only', async () => {
    const sw = load();
    await sw.push({ title: 'Ordinovix', body: 'RSP · 0619E due in 2 days', url: '/tasks/task-rsp-0619e', tag: 'due-task-rsp-0619e' });
    expect(sw.shown).toHaveLength(1);
    expect(sw.shown[0].title).toBe('Ordinovix');
    expect(sw.shown[0].options).toMatchObject({ body: 'RSP · 0619E due in 2 days', tag: 'due-task-rsp-0619e', data: { url: '/tasks/task-rsp-0619e' } });
  });

  it('still shows something neutral when the push has no readable payload', async () => {
    const sw = load();
    await sw.push(undefined);
    expect(sw.shown[0].title).toBe('Ordinovix');
    expect(String(sw.shown[0].options.body)).toMatch(/reminder/i);
    await sw.push('not json');
    expect(sw.shown).toHaveLength(2);
  });

  it('keeps a link to another site out of the notification', async () => {
    const sw = load();
    await sw.push({ title: 'Ordinovix', body: 'x', url: 'https://evil.example/phish', tag: 't' });
    await sw.push({ title: 'Ordinovix', body: 'x', url: '//evil.example', tag: 't' });
    expect((sw.shown[0].options.data as { url: string }).url).toBe('/');
    expect((sw.shown[1].options.data as { url: string }).url).toBe('/');
  });
});

describe('U34 service worker: a click on the notification', () => {
  it('closes it and opens its link in a new window when the app is not open', async () => {
    const sw = load([]);
    const close = await sw.click('/visits/visit-today');
    expect(close).toHaveBeenCalled();
    expect(sw.opened).toEqual(['https://app.test/visits/visit-today']);
  });

  it('focuses the open window and takes it to the link instead of opening another', async () => {
    const win: FakeClient = { url: 'https://app.test/tasks', focus: vi.fn(async () => undefined), navigate: vi.fn(async () => undefined) };
    const sw = load([{ url: 'https://other.test/', focus: vi.fn() }, win]);
    await sw.click('/clients/client-rsp');
    expect(win.focus).toHaveBeenCalled();
    expect(win.navigate).toHaveBeenCalledWith('https://app.test/clients/client-rsp');
    expect(sw.opened).toEqual([]);
  });

  it('opens Today when the notification carries no link', async () => {
    const sw = load([]);
    await sw.click(undefined);
    expect(sw.opened).toEqual(['https://app.test/']);
  });
});
