import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_BRANDING: Required<ExportBranding> = {
  companyName: 'PT Datacomm Diangraha',
  companyTagline: 'IT Service Resilience',
  logoBase64: '',
  primaryColor: '#0F4C81',
  accentColor: '#F59E0B',
  documentFooter: 'Confidential — Internal Use Only',
  defaultDocumentPrefix: 'Disaster Recovery Plan',
  hidePlatformBranding: true,
  documentClassification: 'confidential',
};

function resolveScriptPath(override?: string): string {
  if (override) return override;
  // Resolve relative to this source file: ../../scripts/pdf_renderer.py
  // src/drp/export-service.ts → ../../scripts/pdf_renderer.py
  const here = fileURLToPath(new URL('.', import.meta.url));
  return join(here, '..', '..', 'scripts', 'pdf_renderer.py');
}

function resolveDefaultPythonBin(): string {
  // Use the hermes venv where weasyprint is installed in dev VM.
  return process.env.RESILIPLAN_PYTHON_BIN ?? 'python3';
}

function buildSkeleton(plan: ExportPlan): string {
  const parts: string[] = [];
  for (const section of plan.sections ?? []) {
    parts.push(`=== SECTION: ${section.title} ===`);
    parts.push(section.contentMarkdown);
    parts.push(`> Mapping: ${section.isoClause}`);
    parts.push('');
  }
  return parts.join('\n');
}

export async function renderRichPdfPayload(
  plan: ExportPlan & { id?: string; description?: string; createdAt?: Date | string; updatedAt?: Date | string },
  options: RichPdfOptions = {},
): Promise<ExportPayload> {
  const pythonBin = options.pythonBin ?? resolveDefaultPythonBin();
  const scriptPath = options.scriptPath ?? resolveScriptPath();
  const branding = { ...DEFAULT_BRANDING, ...(options.branding ?? {}) };

  const planJson = {
    id: plan.id ?? plan.serviceName,
    title: plan.title,
    serviceName: plan.serviceName,
    serviceOwner: plan.serviceOwner,
    description: plan.description ?? '',
    criticality: plan.criticality,
    rtoMinutes: plan.rtoMinutes,
    rpoMinutes: plan.rpoMinutes,
    status: plan.status,
    createdAt: plan.createdAt ? (plan.createdAt instanceof Date ? plan.createdAt.toISOString() : plan.createdAt) : '—',
    updatedAt: plan.updatedAt ? (plan.updatedAt instanceof Date ? plan.updatedAt.toISOString() : plan.updatedAt) : '—',
    quality: options.quality,
  };
  const skelJson = { skeleton: buildSkeleton(plan) };
  const brandingJson = branding;

  const workdir = await mkdtemp(join(tmpdir(), 'resiliplan-pdf-'));
  const planPath = join(workdir, 'plan.json');
  const skelPath = join(workdir, 'skel.json');
  const brandingPath = join(workdir, 'branding.json');
  const outPath = join(workdir, 'output.pdf');

  try {
    await writeFile(planPath, JSON.stringify(planJson, null, 2), 'utf8');
    await writeFile(skelPath, JSON.stringify(skelJson, null, 2), 'utf8');
    await writeFile(brandingPath, JSON.stringify(brandingJson, null, 2), 'utf8');

    await new Promise<void>((resolve, reject) => {
      const env = { ...process.env, ...(options.weasyprintBin ? { WEASYPRINT_BIN: options.weasyprintBin } : {}) };
      const child = spawn(pythonBin, [scriptPath, planPath, skelPath, brandingPath, outPath], {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('error', (err) => reject(new Error(`Failed to spawn PDF renderer: ${err.message}`)));
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`PDF renderer exited ${code}: ${stderr.slice(-500)}`));
      });
    });

    const body = await readFile(outPath);
    return { filename: safeFilename(plan.serviceName, 'pdf'), contentType: 'application/pdf', body };
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
  }
}

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
  body: string | Buffer;
};

export type ExportBranding = {
  companyName?: string;
  companyTagline?: string;
  logoBase64?: string;
  primaryColor?: string;
  accentColor?: string;
  documentFooter?: string;
  defaultDocumentPrefix?: string;
  hidePlatformBranding?: boolean;
  documentClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
};

export type ExportQuality = {
  score: number;
  status: string;
  signals: Array<{ key: string; label: string; passed: boolean; weight: number; detail: string }>;
};

export type RichPdfOptions = {
  branding?: ExportBranding;
  quality?: ExportQuality;
  pythonBin?: string;
  scriptPath?: string;
  weasyprintBin?: string;
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

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: Array<{ name: string; content: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const content = Buffer.from(file.content, 'utf8');
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + content.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDir, end]);
}

function markdownToWordParagraphs(markdown: string): string {
  return markdown
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^#+\s*/, '').replace(/^>\s*/, 'Mapping: '))
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`)
    .join('');
}

function buildDocx(plan: ExportPlan): Buffer {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${markdownToWordParagraphs(renderMarkdown(plan))}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  return zipStore([
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', content: documentXml },
  ]);
}

export function renderDocxPayload(plan: ExportPlan): ExportPayload {
  return {
    filename: safeFilename(plan.serviceName, 'docx'),
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    body: buildDocx(plan),
  };
}

export function renderMarkdownPayload(plan: ExportPlan): ExportPayload {
  return { filename: safeFilename(plan.serviceName, 'md'), contentType: 'text/markdown', body: renderMarkdown(plan) };
}
