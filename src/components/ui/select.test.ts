import { describe, it, expect } from 'vitest';
import type { SelectOption } from './select';

describe('Select Component Domain & Option Utilities', () => {
  it('formats select options with display labels and optional descriptions', () => {
    const options: SelectOption[] = [
      { value: 'all', label: 'All Clients' },
      { value: 'rsp', label: 'RSP — RSP Law Offices', description: 'GPP · Makati' },
      { value: 'csl', label: 'CSL — Cruz & Santos Litigation', disabled: true },
    ];

    expect(options).toHaveLength(3);
    expect(options[0].value).toBe('all');
    expect(options[1].description).toBe('GPP · Makati');
    expect(options[2].disabled).toBe(true);
  });

  it('filters options based on search query matching label or description case-insensitively', () => {
    const options: SelectOption[] = [
      { value: 'all', label: 'All Clients' },
      { value: 'rsp', label: 'RSP — RSP Law Offices', description: 'GPP · Makati' },
      { value: 'csl', label: 'CSL — Cruz & Santos Litigation', description: 'Solo · QC' },
      { value: 'mel', label: 'MEL — Atty. Maria Elena Lopez', description: 'Solo · Pasig' },
    ];

    const filter = (query: string) => {
      const q = query.toLowerCase().trim();
      if (!q) return options;
      return options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(q) ||
          (opt.description && opt.description.toLowerCase().includes(q))
      );
    };

    expect(filter('')).toHaveLength(4);
    expect(filter('rsp')).toHaveLength(1);
    expect(filter('rsp')[0].value).toBe('rsp');

    // Matches description
    expect(filter('makati')).toHaveLength(1);
    expect(filter('makati')[0].value).toBe('rsp');

    // Case insensitive match
    expect(filter('CRUZ')).toHaveLength(1);
    expect(filter('CRUZ')[0].value).toBe('csl');

    // Multi-match
    expect(filter('solo')).toHaveLength(2);
  });

  it('handles empty query and unmatched query gracefully', () => {
    const options: SelectOption[] = [
      { value: '1', label: 'Option 1' },
      { value: '2', label: 'Option 2' },
    ];

    const filter = (query: string) => {
      const q = query.toLowerCase().trim();
      if (!q) return options;
      return options.filter((opt) => opt.label.toLowerCase().includes(q));
    };

    expect(filter('xyz')).toHaveLength(0);
  });
});
