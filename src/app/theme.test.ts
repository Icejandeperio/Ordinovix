import { describe, it, expect } from 'vitest';
import { PALETTES } from './theme';

describe('palette names (B29)', () => {
  it('no palette name or tagline refers to BIR or an official look', () => {
    for (const p of PALETTES) {
      expect(`${p.name} ${p.tagline}`, p.id).not.toMatch(/\bBIR\b|\bBureau\b|official/i);
    }
  });

  it('keeps the vermilion palette id so saved preferences still work', () => {
    expect(PALETTES.some((p) => p.id === 'vermilion')).toBe(true);
  });
});
