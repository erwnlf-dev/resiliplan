import { describe, expect, it } from 'vitest';
import { ISO_22301_SECTIONS, defaultSectionContent } from './iso-template.js';

describe('ISO 22301 template', () => {
  it('contains 14 ordered sections with compliance clauses', () => {
    expect(ISO_22301_SECTIONS).toHaveLength(14);
    expect(ISO_22301_SECTIONS.map((section) => section.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(ISO_22301_SECTIONS.every((section) => section.isoClause.includes('ISO 22301'))).toBe(true);
  });

  it('creates default section content with compliance reference and validation note', () => {
    const content = defaultSectionContent(ISO_22301_SECTIONS[0]);
    expect(content).toContain('Compliance reference');
    expect(content).toContain('ISO 22301:2019 Clause 4');
    expect(content).toContain('Perlu dilengkapi dan divalidasi');
  });
});
