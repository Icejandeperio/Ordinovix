import { describe, it, expect } from 'vitest';
import { isMockDataSource } from './data-source';

describe('isMockDataSource (B18: dev tools only in mock mode)', () => {
  it('is true when VITE_DATA_SOURCE is unset or mock', () => {
    expect(isMockDataSource(undefined)).toBe(true);
    expect(isMockDataSource('')).toBe(true);
    expect(isMockDataSource('mock')).toBe(true);
  });

  it('is false only when VITE_DATA_SOURCE is api', () => {
    expect(isMockDataSource('api')).toBe(false);
  });
});
