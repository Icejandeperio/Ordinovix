import { describe, expect, it } from 'vitest';
import { safeNext, signInPath } from './auth';

describe('U39 where sign-in sends the person back to', () => {
  it('keeps an in-app path with its query and hash', () => {
    expect(safeNext('/tasks')).toBe('/tasks');
    expect(safeNext('/clients?status=active#top')).toBe('/clients?status=active#top');
  });

  it('falls back to Today for anything that is not a plain in-app path', () => {
    for (const bad of [undefined, null, '', 'tasks', '//evil.example/x', '/\\evil.example', 'https://evil.example/', 'javascript:alert(1)', '/a\nb']) {
      expect(safeNext(bad)).toBe('/');
    }
  });

  it('never sends the person back to the sign-in or access-pending pages', () => {
    expect(safeNext('/sign-in')).toBe('/');
    expect(safeNext('/sign-in?next=%2Ftasks')).toBe('/');
    expect(safeNext('/access-pending')).toBe('/');
  });

  it('builds the sign-in path with the wanted page, and none for Today', () => {
    expect(signInPath('/tasks?x=1')).toBe('/sign-in?next=%2Ftasks%3Fx%3D1');
    expect(signInPath('/')).toBe('/sign-in');
    expect(signInPath()).toBe('/sign-in');
    expect(signInPath('//evil.example')).toBe('/sign-in');
  });
});
