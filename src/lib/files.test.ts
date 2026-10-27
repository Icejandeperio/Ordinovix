import { describe, it, expect } from 'vitest';
import { documentDisplayName, documentKindSlug, templateCodeSlug, periodSlug } from './files';

describe('document naming convention (spec 9.9)', () => {
  it('maps every document kind to its slug', () => {
    expect(documentKindSlug('source')).toBe('src');
    expect(documentKindSlug('filed_return')).toBe('return');
    expect(documentKindSlug('acknowledgment')).toBe('ack');
    expect(documentKindSlug('payment_proof')).toBe('payproof');
    expect(documentKindSlug('stamped_copy')).toBe('stamped');
    expect(documentKindSlug('ecar')).toBe('ecar');
    expect(documentKindSlug('authorization')).toBe('auth');
    expect(documentKindSlug('other')).toBe('other');
  });

  it('strips template codes down to letters and digits', () => {
    expect(templateCodeSlug('BIR 1601-EQ')).toBe('1601EQ');
    expect(templateCodeSlug('ECAR-SALE')).toBe('ECARSALE');
    expect(templateCodeSlug(undefined)).toBe('TASK');
  });

  it('writes quarters without a hyphen and keeps months and dates', () => {
    expect(periodSlug('2026-Q3')).toBe('2026Q3');
    expect(periodSlug('2026-09')).toBe('2026-09');
    expect(periodSlug('2026')).toBe('2026');
    expect(periodSlug('2026-10-12')).toBe('2026-10-12');
  });

  it('builds the spec examples', () => {
    expect(
      documentDisplayName({ clientCode: 'RSP', templateCode: 'BIR 1601-EQ', period: '2026-Q3', kind: 'acknowledgment', versionNo: 1, originalName: 'scan.PDF' })
    ).toBe('RSP_1601EQ_2026Q3_ack_v1.pdf');
    expect(
      documentDisplayName({ clientCode: 'BOL', templateCode: 'ECAR-SALE', period: '2026-10-12', kind: 'stamped_copy', versionNo: 2, originalName: 'IMG_0042.jpeg' })
    ).toBe('BOL_ECARSALE_2026-10-12_stamped_v2.jpeg');
  });

  it('falls back to the mime type, then pdf, for the extension', () => {
    expect(documentDisplayName({ clientCode: 'RSP', period: '2026-09', kind: 'other', versionNo: 1, originalName: 'noext', mimeType: 'image/png' })).toBe('RSP_TASK_2026-09_other_v1.png');
    expect(documentDisplayName({ clientCode: 'RSP', period: '2026-09', kind: 'other', versionNo: 1, originalName: 'noext' })).toBe('RSP_TASK_2026-09_other_v1.pdf');
  });
});
