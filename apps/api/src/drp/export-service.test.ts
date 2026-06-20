import { describe, expect, it } from 'vitest';
import { renderDocxPayload, renderMarkdown, renderPdfPayload } from './export-service.js';

const plan = {
  id: 'plan-1',
  title: 'DRP Core Service',
  serviceName: 'Core Service',
  serviceOwner: 'Erwin Alifiansyah',
  criticality: 'high',
  rtoMinutes: 120,
  rpoMinutes: 30,
  version: 2,
  status: 'approved',
  sections: [
    { title: '1. Context and Scope', isoClause: 'ISO 22301:2019 Clause 4', contentMarkdown: '## Context\nService scope.' },
    { title: '2. Leadership', isoClause: 'ISO 22301:2019 Clause 5', contentMarkdown: '## Leadership\nOwner list.' },
  ],
};

describe('export-service', () => {
  it('renders audit-ready markdown with service metadata and ISO clauses', () => {
    const markdown = renderMarkdown(plan);
    expect(markdown).toContain('# DRP Core Service');
    expect(markdown).toContain('**Service:** Core Service');
    expect(markdown).toContain('**RTO:** 120 minutes');
    expect(markdown).toContain('ISO 22301:2019 Clause 4');
  });

  it('renders a PDF payload with valid PDF header', () => {
    const pdf = renderPdfPayload(plan);
    expect(pdf.contentType).toBe('application/pdf');
    expect(pdf.body.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.filename).toBe('Core Service.pdf');
  });

  it('renders a docx-compatible payload with explicit limitation note', () => {
    const docx = renderDocxPayload(plan);
    expect(docx.contentType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(docx.body).toContain('DOCX placeholder');
    expect(docx.filename).toBe('Core Service.docx');
  });
});
