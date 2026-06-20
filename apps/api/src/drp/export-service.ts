export type ExportSection = {
  title: string;
  isoClause: string;
  contentMarkdown: string;
};

export type ExportPlan = {
  title: string;
  serviceName: string;
  serviceOwner: string;
  criticality: string;
  rtoMinutes: number;
  rpoMinutes: number;
  version: number;
  status: string;
  sections?: ExportSection[];
};

export type ExportPayload = {
  filename: string;
  contentType: string;
  body: string;
};

function safeFilename(name: string, extension: string): string {
  return `${name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'resiliplan-export'}.${extension}`;
}

export function renderMarkdown(plan: ExportPlan): string {
  const lines = [
    `# ${plan.title}`,
    '',
    `**Service:** ${plan.serviceName}`,
    `**Service owner:** ${plan.serviceOwner}`,
    `**Criticality:** ${plan.criticality}`,
    `**RTO:** ${plan.rtoMinutes} minutes`,
    `**RPO:** ${plan.rpoMinutes} minutes`,
    `**Version:** ${plan.version}`,
    `**Status:** ${plan.status}`,
    '',
    '---',
    '',
  ];
  for (const section of plan.sections ?? []) {
    lines.push(section.contentMarkdown, '', `> Mapping: ${section.isoClause}`, '', '---', '');
  }
  return lines.join('\n');
}

function escapePdfText(value: string): string {
  return value.replace(/[()\\]/g, '\\$&').replace(/[\r\n]+/g, '\n');
}

export function renderPdfPayload(plan: ExportPlan): ExportPayload {
  const text = escapePdfText(renderMarkdown(plan)).slice(0, 6000);
  const stream = `BT /F1 10 Tf 40 760 Td (${text.replace(/\n/g, ') Tj 0 -14 Td (')}) Tj ET`;
  const body = `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj\ntrailer << /Root 1 0 R >>\n%%EOF`;
  return { filename: safeFilename(plan.serviceName, 'pdf'), contentType: 'application/pdf', body };
}

export function renderDocxPayload(plan: ExportPlan): ExportPayload {
  const body = [
    'DOCX placeholder — editable markdown payload for Phase 1 internal MVP.',
    'Real OOXML packaging is planned as a later hardening task.',
    '',
    renderMarkdown(plan),
  ].join('\n');
  return {
    filename: safeFilename(plan.serviceName, 'docx'),
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    body,
  };
}

export function renderMarkdownPayload(plan: ExportPlan): ExportPayload {
  return { filename: safeFilename(plan.serviceName, 'md'), contentType: 'text/markdown', body: renderMarkdown(plan) };
}
