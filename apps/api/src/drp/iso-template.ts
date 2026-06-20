export type SectionTemplate = {
  key: string;
  title: string;
  isoClause: string;
  prompt: string;
  order: number;
};

export const ISO_22301_SECTIONS: SectionTemplate[] = [
  { key: 'context', title: '1. Context and Scope', isoClause: 'ISO 22301:2019 Clause 4', order: 1, prompt: 'Scope layanan, asumsi, dependency utama, dan batasan DRP.' },
  { key: 'leadership', title: '2. Leadership and Ownership', isoClause: 'ISO 22301:2019 Clause 5', order: 2, prompt: 'Owner layanan, DR coordinator, approver, dan tanggung jawab.' },
  { key: 'planning', title: '3. Planning and Objectives', isoClause: 'ISO 22301:2019 Clause 6', order: 3, prompt: 'Objective recovery, RTO, RPO, criticality, risk appetite.' },
  { key: 'support', title: '4. Support and Resources', isoClause: 'ISO 22301:2019 Clause 7', order: 4, prompt: 'SDM, akses, tools, backup media, network, vendor, dan communication channel.' },
  { key: 'operation', title: '5. Operational Control', isoClause: 'ISO 22301:2019 Clause 8.1', order: 5, prompt: 'Kontrol operasional sebelum, saat, dan setelah DR activation.' },
  { key: 'bia', title: '6. Business Impact Analysis', isoClause: 'ISO 22301:2019 Clause 8.2.2', order: 6, prompt: 'Impact 1 jam / 4 jam / 24 jam, service tier, business dependency.' },
  { key: 'risk', title: '7. Risk Assessment', isoClause: 'ISO 22301:2019 Clause 8.2.3', order: 7, prompt: 'Threat scenario, likelihood, impact, mitigasi, residual risk.' },
  { key: 'strategy', title: '8. Recovery Strategy', isoClause: 'ISO 22301:2019 Clause 8.3', order: 8, prompt: 'Strategi recovery: backup-restore, warm standby, hot standby, manual workaround.' },
  { key: 'procedure', title: '9. Recovery Procedure', isoClause: 'ISO 22301:2019 Clause 8.4', order: 9, prompt: 'Langkah recovery runbook, urutan aktivitas, PIC, estimasi waktu, rollback point.' },
  { key: 'communication', title: '10. Communication Plan', isoClause: 'ISO 22301:2019 Clause 8.4.3', order: 10, prompt: 'Escalation tree, stakeholder update, customer/internal communication.' },
  { key: 'validation', title: '11. Validation and Acceptance Criteria', isoClause: 'ISO 22301:2019 Clause 8.5', order: 11, prompt: 'Health check teknis, user validation, data validation, pass/fail criteria.' },
  { key: 'exercise', title: '12. Exercise and Testing Plan', isoClause: 'ISO 22301:2019 Clause 8.5', order: 12, prompt: 'Jadwal drill, test scope, expected evidence, post-test improvement.' },
  { key: 'performance', title: '13. Performance Evaluation', isoClause: 'ISO 22301:2019 Clause 9', order: 13, prompt: 'Metric recovery, audit evidence, KPI, review cadence.' },
  { key: 'improvement', title: '14. Continual Improvement', isoClause: 'ISO 22301:2019 Clause 10', order: 14, prompt: 'Lessons learned, corrective action, owner, due date, version update rule.' },
];

export function defaultSectionContent(section: SectionTemplate): string {
  return `## ${section.title}\n\n**Compliance reference:** ${section.isoClause}\n\n**Draft guidance:** ${section.prompt}\n\nPerlu dilengkapi dan divalidasi oleh service owner.\n`;
}
