# DRPBuilder — Disaster Recovery Plan Builder (SaaS)

> **Status:** PRD v1.0 — Master Grand Plan
> **Author:** Erwin Alifiansyah · IT Service Resilience · PT Datacomm Diangraha
> **Tanggal:** 2026-06-20
> **Repositori:** `~/ITResilience_Prod/DRPBuilder`

---

## 1. Pendahuluan

### 1.1 Visi & Misi

**Visi:** Menjadi platform standar industri di Indonesia untuk membangun, menguji, dan memelihara Disaster Recovery Plan (DRP) yang teruji, terdokumentasi, dan patuh terhadap standar internasional (NIST SP 800-34, ISO 22301, BCI GPG).

**Misi:** Mengubah DR planning dari proses dokumentasi statis yang berjam-jam menjadi workflow kolaboratif yang dibantu AI — dengan output yang siap-audit, dapat di-ekspor, dan dapat di-uji.

### 1.2 Problem Statement

Saat ini (2026), DR planning di enterprise Indonesia masih menghadapi 6 masalah utama:

1. **Template lama & inkonsisten** — setiap tim bikin format sendiri, tidak ada standarisasi. Dokumen Word/Excel yang tidak bisa di-version-control.
2. **Proses manual & lambat** — bikin DRP 1 service bisa 2-4 minggu (BIA → Risk → Strategy → Procedure → Test Plan).
3. **Tidak ter-update** — DRP di-draft sekali, lalu dilupakan 2-3 tahun sampai audit. Asset sudah berubah, RTO/RPO tidak valid lagi.
4. **Tidak tested** — 70% DRP tidak pernah diuji drill. Saat incident, prosedur tidak match realita.
5. **Siloed** — dokumen di-share folder, tidak ada ownership, tidak ada approval workflow, tidak ada audit trail.
6. **Tidak patuh framework** — auditor minta mapping ke NIST/ISO, tapi DRP existing tidak punya traceability ke control.

### 1.3 Target Users

| Persona | Role | Pain | Outcome yang diharapkan |
|---|---|---|---|
| **DR Coordinator** (primary) | Orang yang ditunjuk manage BCP/DRP | Spend 60% waktu di admin (format, cari info, compile) | AI handle 80% boilerplate, fokus ke strategi & validasi |
| **IT Service Manager** | Own availability target & risk appetite | Tidak punya visibility status DRP per service | Dashboard real-time: service X → DRP status (Draft/Approved/Tested) |
| **System Owner** | Engineer yang punya service | Tidak tau cara tulis DRP yang bener | AI coach: "untuk service database, section Procedure harus include failover steps..." |
| **CISO / Auditor** | Validasi compliance | Susah trace control NIST ke procedure | Auto-mapping: section X → NIST CP-2, ISO A.17.1.1 |
| **CIO / Direksi** | Approver & risk owner | Lihat DRP sebagai black box, hanya sign | Executive dashboard: top 5 risiko, tested/untested, RTO actual vs target |

### 1.4 Success Metrics (12 bulan pertama)

| Metric | Baseline (today) | Target (M12) |
|---|---|---|
| Time to draft DRP per service | 2-4 minggu | 1-2 hari |
| DRP coverage (% critical service with approved DRP) | ~30% | 90% |
| DRP tested in last 12 months | ~30% | 80% |
| Auditor finding terkait DRP | 5-10/tahun | 0-1/tahun |
| Plan update frequency | Every 2-3 tahun | Setiap ada perubahan infra (auto-trigger) |
| User NPS | N/A | ≥ 50 |

---

## 2. Solusi — DRPBuilder

### 2.1 Value Proposition

> "Bikin DRP 10x lebih cepat dengan AI co-pilot yang memahami konteks, standar, dan best practice. Setiap section ter-validasi compliance. Setiap perubahan ter-audit. Setiap tahun diuji drill dengan tracking real."

**Tagline:** *From static document to living plan.*

### 2.2 Differentiators vs Alternatif

| Capability | DRPBuilder | Word/Excel | Generic Doc (Notion/Confluence) | Enterprise BCM (Fusion, Archer) |
|---|---|---|---|---|
| AI Co-pilot per section | ✅ Built-in | ❌ | ❌ | ❌ |
| Multi-provider AI (OpenAI/Anthropic/custom) | ✅ | ❌ | ❌ | ❌ |
| Compliance auto-mapping (NIST/ISO/BCI) | ✅ | ❌ | ❌ | ✅ (manual) |
| Version control + diff | ✅ | ❌ | ✅ | ✅ |
| Approval workflow + e-sign | ✅ | ❌ | ❌ | ✅ |
| Drill scheduling + results | ✅ | ❌ | ❌ | ❌ |
| Multi-tenant SaaS | ✅ | ❌ | ❌ | ✅ |
| Bahasa Indonesia native | ✅ | ✅ | ❌ | ❌ |
| Harga (SMB-friendly) | $$ | Free | $ | $$$$ |

### 2.3 High-level Capabilities

1. **AI-assisted drafting** — Generate section per section dengan context awareness.
2. **Template library** — NIST SP 800-34, ISO 22301, BCI GPG, custom corporate.
3. **BIA (Business Impact Analysis)** — Structured form per service, hitung criticality tier.
4. **RTO/RPO calculator** — Berdasarkan tier, dependency, recovery strategy.
5. **Asset & dependency registry** — Linked to systems, services, third-party.
6. **Procedure library** — Reusable runbook (recover DB, restore VM, failover DNS).
7. **Risk register** — Link risk ke section mitigasi di DRP.
8. **Approval workflow** — Multi-stage: Draft → Review → Approve → Sign.
9. **Drill/test scheduler** — Schedule, capture hasil, update DRP dari learnings.
10. **Audit trail** — Every change: who, when, what, why.
11. **Export** — PDF (formal), DOCX (editable), Markdown (git-friendly), JSON (interop).
12. **Collaboration** — Real-time multi-user edit, comment, mention.
13. **API & webhook** — Integrate dengan infra (CMDB, ITSM, monitoring).
14. **Offline mode (PWA)** — Akses DRP saat incident tanpa internet.

---

## 3. Use Cases

### 3.1 UC-01: Draft DRP Baru untuk Service Baru

**Actor:** DR Coordinator, System Owner
**Trigger:** Service baru on-boarded ke production
**Flow:**
1. Create new DRP dari template "Database Service" atau "Web Application"
2. AI pre-fill Section 1-5 berdasarkan metadata service (type, criticality, dependencies)
3. System Owner isi BIA (impact jika down 1h, 4h, 24h)
4. AI suggest RTO/RPO tier berdasarkan impact analysis
5. DR Coordinator pilih recovery strategy (Hot Standby, Warm Standby, Backup-Restore)
6. AI generate draft Section 6-10 (Procedure, Validation, Communication)
7. Submit for review → Approval workflow → Publish

**Outcome:** DRP v1.0 approved dalam 1-2 hari (vs 2-4 minggu manual).

### 3.2 UC-02: Update DRP Setelah Perubahan Infra

**Actor:** System Owner, DR Coordinator
**Trigger:** Webhook dari CMDB: server X decomm, server Y added
**Flow:**
1. System notifikasi: "DRP untuk Service A perlu di-review (ada perubahan dependency)"
2. User buka DRP, AI highlight section yang impacted
3. User edit, AI suggest update berdasarkan dependency baru
4. Auto-increment version, log change
5. Re-approval jika material change (RTO/RPO berubah, dependency baru)

### 3.3 UC-03: Annual DR Drill

**Actor:** DR Coordinator, IT Operations
**Trigger:** Drill schedule (e.g., Q1 each year)
**Flow:**
1. Create drill session, pilih DRP yang diuji
2. Print/download "Drill Worksheet" — checklist per procedure
3. During drill: capture timestamp per step, issue yang muncul
4. Post-drill: AI compare actual vs estimated RTO, flag gap
5. Update DRP dengan learnings (auto-suggested diff)

### 3.4 UC-04: Auditor Request

**Actor:** Auditor (external/internal)
**Flow:**
1. Auditor request: "Tunjukkan DRP untuk service critical + evidence testing"
2. DR Coordinator generate "Auditor Package" — DRP + drill history + approval log
3. Export as ZIP: PDF DRP, drill reports, change log, sign-off documents

### 3.5 UC-05: AI Co-pilot Inline (during edit)

**Trigger:** User mengetik di section
**Capabilities:**
- "Improve writing" — Polish grammar, tone, clarity
- "Add best practice" — Inject NIST/ISO control reference
- "Check consistency" — Flag: "RTO di section 3 tidak match RTO di section 7"
- "Suggest procedure" — "Untuk database Postgres dengan hot standby, langkah recovery yang umum..."
- "Translate" — ID ↔ EN

---

## 4. Functional Requirements

### 4.1 Core (MVP — Phase 1)

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-01 | Tenant & user management | P0 | Org, workspace, role (Admin/Coordinator/Owner/Viewer) |
| F-02 | DRP CRUD | P0 | Create, Read, Update, Delete DRP per service |
| F-03 | Template engine | P0 | NIST, ISO 22301, BCI, custom template support |
| F-04 | Section editor | P0 | Rich text (Markdown + WYSIWYG) dengan section structure |
| F-05 | BIA form | P0 | Structured: impact 1h/4h/24h, criticality tier |
| F-06 | RTO/RPO assignment | P0 | Per service, dengan tier-based suggestion |
| F-07 | Approval workflow | P0 | Multi-stage: Draft → Review → Approve → Sign (e-sign) |
| F-08 | Version control | P0 | History, diff view, rollback |
| F-09 | Export PDF | P0 | Professional layout, cover page, TOC, signatures |
| F-10 | Export DOCX | P0 | Editable, retain formatting |
| F-11 | Export Markdown | P1 | Git-friendly, untuk repo/VCS |
| F-12 | Audit log | P0 | Every change tracked: who, when, what, why |
| F-13 | Auth (email + SSO) | P0 | Email/password, Google SSO, Microsoft SSO |
| F-14 | Multi-language | P1 | ID + EN, per-org default |

### 4.2 AI Features (Phase 2)

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-20 | AI Co-pilot inline | P0 | Real-time suggestions, "improve", "add detail", "translate" |
| F-21 | Section auto-draft | P0 | Dari metadata + context, generate section content |
| F-22 | Consistency check | P0 | Detect RTO/RPO mismatch, missing sections, duplikasi |
| F-23 | Best practice injection | P1 | Reference NIST/ISO controls per section |
| F-24 | AI audit | P1 | Periodic AI review: flag outdated, missing, weak sections |
| F-25 | BIA analyzer | P1 | Suggest tier berdasarkan impact matrix |
| F-26 | Procedure generator | P0 | Dari system type + recovery strategy, generate runbook draft |
| F-27 | Multi-provider AI | P0 | OpenAI, Anthropic, custom baseURL, BYO API key |
| F-28 | Streaming response | P0 | UX real-time saat AI generate |
| F-29 | AI cost tracking | P1 | Per-org token usage, alert budget |

### 4.3 Collaboration (Phase 3)

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-30 | Real-time multi-user | P0 | Live cursor, presence, conflict-free editing (CRDT) |
| F-31 | Comments & threads | P0 | Inline comment per section, mention, resolve |
| F-32 | Notification | P0 | Email + in-app: approval pending, mention, drill reminder |
| F-33 | Activity feed | P1 | Recent changes per org |
| F-34 | @mention | P0 | Notifikasi ke user spesifik |

### 4.4 Enterprise (Phase 4)

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-40 | Drill scheduler | P0 | Calendar view, assign PIC, template drill |
| F-41 | Drill capture | P0 | During drill: timestamp per step, issue log |
| F-42 | Drill report | P0 | AI-generated post-drill report dengan gap analysis |
| F-43 | Risk register | P0 | Link ke DRP section mitigasi |
| F-44 | Asset registry | P0 | CMDB integration: server, network, service dependency |
| F-45 | Compliance mapping | P0 | Auto-map section → NIST SP 800-34 / ISO 22301 / BCI control |
| F-46 | Auditor package | P0 | ZIP export: DRP + drill + change log + sign-off |
| F-47 | Webhook | P1 | CMDB change → trigger DRP review |
| F-48 | API | P1 | REST API untuk integration |
| F-49 | White-label | P2 | Custom domain, logo, color |
| F-50 | Offline mode (PWA) | P1 | Akses DRP tanpa internet saat incident |

---

## 5. Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| **Performance** | Page load (P95) | < 1.5s |
| | AI response first token | < 2s |
| | AI response full (typical section) | < 8s |
| | Search (plan/asset) | < 500ms |
| **Availability** | Uptime | 99.9% (8.7h downtime/year) |
| | Disaster recovery (our own) | RTO 4h, RPO 1h |
| **Scalability** | Concurrent users per org | 100+ |
| | Plans per org | 1,000+ |
| | Total tenants | 10,000+ (Phase 4) |
| **Security** | Encryption at rest | AES-256 |
| | Encryption in transit | TLS 1.3 |
| | Auth | JWT + refresh, RBAC, audit log |
| | Data residency | Indonesia (primary), configurable |
| **Compliance** | Standards | SOC 2 Type II (Phase 4), ISO 27001 (future) |
| **Accessibility** | WCAG | 2.1 AA |
| **Browser** | Support | Chrome, Firefox, Safari, Edge (last 2 versions) |
| **Mobile** | PWA | iOS Safari, Android Chrome |
| **i18n** | Languages | ID, EN (primary) |

---

## 6. Teknologi & Arsitektur

### 6.1 Stack Decision (Rekomendasi)

| Layer | Pilihan | Rationale |
|---|---|---|
| **Frontend** | Vite + React 18 + TypeScript | Fast HMR, mature, matches existing ITResilience stack, smaller bundle than Next.js untuk SaaS dashboard |
| **UI Components** | shadcn/ui (Radix UI) + Tailwind CSS | Aesthetic, customizable, accessible, copy-paste (no dependency lock-in) |
| **State** | Zustand (client) + TanStack Query (server) | Lightweight, no Redux overhead |
| **Forms** | React Hook Form + Zod | Type-safe, performant |
| **Routing** | React Router v6 | Standard SPA |
| **Backend** | Fastify + TypeScript | Same as visual-agent-worker-saas, fast, schema-first |
| **Database** | PostgreSQL (Neon/Supabase) | Multi-tenant, RLS, JSON columns |
| **ORM** | Drizzle ORM | Type-safe, SQL-first, lightweight vs Prisma |
| **Auth** | Lucia Auth atau Auth.js | Self-host friendly, multi-provider (email, Google, Microsoft) |
| **AI Layer** | Vercel AI SDK (`ai` package) | Native multi-provider abstraction: `createOpenAI`, `@ai-sdk/anthropic`, custom baseURL |
| **Job Queue** | BullMQ + Redis (Upstash) | Background AI jobs, drill reminders, email send |
| **File Storage** | S3 / R2 | Export PDF/DOCX, attachment, drill evidence |
| **Email** | Resend | Modern, simple API, good DX |
| **Realtime** | Yjs + Hocuspocus | CRDT for multi-user editing, no conflict |
| **PDF Export** | Puppeteer (HTML→PDF) atau react-pdf | High fidelity, customizable |
| **DOCX Export** | `docx` library | Programmatic generation |
| **Logging** | Pino (server) + console (client) | Fast, structured |
| **Observability** | Sentry + OpenTelemetry | Error tracking, trace |
| **Deployment** | Docker + Cloudflare (frontend) + Fly.io/Railway (backend) | Low cost, fast deploy |
| **CI/CD** | GitHub Actions | Lint, test, build, deploy |

### 6.2 Arsitektur (High-level)

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React SPA + PWA)                                  │
│  ├── shadcn/ui components                                   │
│  ├── Zustand (client state)                                 │
│  ├── TanStack Query (server state, cache)                   │
│  ├── Yjs (CRDT realtime collab)                            │
│  └── Service Worker (offline mode)                          │
└─────────────────────────────────────────────────────────────┘
                          │ HTTPS / WSS
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Fastify API (Node.js + TypeScript)                         │
│  ├── Routes: /auth, /orgs, /plans, /sections, /bia, ...     │
│  ├── Middleware: auth, rate-limit, audit, RLS               │
│  ├── AI Service Layer (Vercel AI SDK)                       │
│  │   ├── OpenAI Provider (custom baseURL)                  │
│  │   ├── Anthropic Provider (custom baseURL)                │
│  │   ├── OpenAI-compatible (Together, Groq, OpenRouter)     │
│  │   └── Custom (BYO endpoint + key)                        │
│  ├── Job Producer (BullMQ)                                  │
│  └── PDF/DOCX Generator                                     │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ PostgreSQL   │  │ Redis        │  │ S3 / R2      │
│ (Neon)       │  │ (Upstash)    │  │ (Cloudflare) │
│ - tenants    │  │ - jobs       │  │ - exports    │
│ - plans      │  │ - cache      │  │ - attachments│
│ - sections   │  │ - sessions   │  │ - evidence   │
│ - audit      │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
                          │
                          ▼
                ┌──────────────────┐
                │ External AI APIs │
                │ - OpenAI         │
                │ - Anthropic      │
                │ - Custom URL     │
                │ - Local LLM      │
                └──────────────────┘
```

### 6.3 Multi-Tenancy

- **Strategy:** Shared database, row-level security (RLS) dengan `tenant_id` di semua tabel.
- **Isolation:** Tenant context di-extract dari JWT, enforced di Drizzle query helper.
- **Performance:** Index pada `tenant_id` + composite untuk query pattern umum.

---

## 7. AI Integration Design (Deep Dive)

### 7.1 Kebutuhan

User perlu fleksibilitas:
- Pakai OpenAI langsung (default)
- Pakai Anthropic langsung
- Pakai OpenAI-compatible (Together, Groq, OpenRouter, local llama.cpp, vLLM)
- Self-host dengan custom URL (on-prem LLM, corporate gateway)
- BYO API key (data privacy)

### 7.2 Provider Abstraction Layer

Gunakan **Vercel AI SDK** (`ai` v4) yang native support multi-provider:

```typescript
// server/services/ai/provider-factory.ts
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelV1 } from 'ai';

export type AIProviderConfig = {
  provider: 'openai' | 'anthropic' | 'openai-compatible' | 'anthropic-compatible';
  apiKey: string;
  baseURL?: string;       // custom endpoint
  model: string;           // e.g. 'gpt-4o', 'claude-sonnet-4-5', 'llama-3.1-70b'
  organization?: string;   // OpenAI org
  defaultHeaders?: Record<string, string>;  // corporate proxy headers
  maxRetries?: number;
  timeout?: number;
};

export function createAIModel(config: AIProviderConfig): LanguageModelV1 {
  switch (config.provider) {
    case 'openai':
    case 'openai-compatible':
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,  // null = default OpenAI
        organization: config.organization,
        headers: config.defaultHeaders,
      })(config.model);

    case 'anthropic':
    case 'anthropic-compatible':
      return createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.baseURL,  // null = default Anthropic
        headers: config.defaultHeaders,
      })(config.model);
  }
}
```

### 7.3 Use Cases per Section

Setiap section punya prompt template + context builder. Contoh:

```typescript
// server/services/ai/prompts/draft-section.ts
export const sectionPrompts = {
  'executive-summary': {
    system: `Anda adalah konsultan DR/BCP senior. Tulis executive summary DRP yang:
- 1 paragraf, maximum 200 kata
- Bahasa formal tapi tidak jargon berlebihan
- Cover: tujuan, scope, key RTO/RPO, status approval`,
    context: (plan) => ({
      planName: plan.name,
      serviceType: plan.service_type,
      criticalityTier: plan.tier,
      rto: plan.rto_minutes,
      rpo: plan.rpo_minutes,
      strategy: plan.recovery_strategy,
    }),
    userTemplate: (ctx) => `Buat executive summary untuk DRP "${ctx.planName}".
Service type: ${ctx.serviceType}, Tier: ${ctx.criticalityTier},
RTO: ${ctx.rto} menit, RPO: ${ctx.rpo} menit,
Recovery strategy: ${ctx.strategy}.`,
  },

  'procedure-recovery': {
    system: `Anda adalah SRE senior. Buat step-by-step recovery procedure yang:
- Numbered list, tiap step imperative + verifiable
- Include expected duration per step
- Include rollback jika gagal
- Reference specific commands/tools (jangan generic)`,
    context: (plan, asset) => ({
      serviceType: plan.service_type,
      strategy: plan.recovery_strategy,
      platform: asset.platform,
      techStack: asset.tech_stack,
      dependencies: asset.dependencies,
    }),
  },
  // ... dst
};
```

### 7.4 Streaming + Cost Control

```typescript
// server/routes/ai/draft-section.ts (Fastify)
import { streamText } from 'ai';

fastify.post('/ai/draft-section', async (req, reply) => {
  const { planId, sectionId, modelConfig } = req.body;
  const plan = await loadPlan(planId);
  const section = plan.sections.find(s => s.id === sectionId);
  const model = createAIModel(modelConfig);

  // Track token usage
  const usageTracker = new TokenUsageTracker(req.user.orgId);

  return streamText({
    model,
    system: sectionPrompts[section.template].system,
    prompt: buildPrompt(section, plan),
    onFinish: (result) => {
      usageTracker.log({
        model: modelConfig.model,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        cost: estimateCost(modelConfig.model, result.usage),
      });
    },
  }).toDataStreamResponse();
});
```

### 7.5 AI Features Mapping

| Section | AI Capability | Trigger |
|---|---|---|
| Executive Summary | Auto-draft | User click "Generate" |
| Scope | Auto-suggest scope items | New plan created |
| Assumptions | Consistency check | On save |
| Roles & Responsibilities | Suggest roles from org chart | On create |
| System Description | Auto-draft from asset metadata | Asset linked |
| Risk Assessment | Suggest risks from system type | New section |
| Recovery Strategy | Recommend strategy from BIA tier | BIA saved |
| Communication Plan | Template with org data | Template selection |
| Activation Criteria | Best practice injection | On view |
| Procedure | Auto-draft runbook from system type | User click |
| Validation | Cross-check RTO/RPO vs procedure time | On save |
| Test Plan | Suggest test scenarios from strategy | On view |

---

## 8. Data Model (High-level)

```sql
-- Tenant & user
tenants (id, name, slug, plan_tier, settings, created_at)
users (id, tenant_id, email, name, role, password_hash, sso_provider, created_at)
tenant_members (tenant_id, user_id, role, invited_at, joined_at)

-- Plan core
plans (id, tenant_id, name, service_id, template_id, status, tier, rto_minutes, rpo_minutes, recovery_strategy, current_version, created_by, created_at, updated_at)
plan_versions (id, plan_id, version_number, content_json, content_markdown, status, created_by, approved_by, approved_at, change_summary)

-- Section structure
sections (id, plan_id, template_section_id, order, title, content, content_html, ai_suggested, last_edited_by, updated_at)
section_comments (id, section_id, user_id, body, resolved, parent_id, created_at)

-- BIA
bia_entries (id, plan_id, scenario, impact_1h, impact_4h, impact_24h, financial_impact, reputational_impact, regulatory_impact, criticality_tier)
bia_dependencies (id, bia_id, depends_on_service_id, dependency_type)

-- Assets
assets (id, tenant_id, name, type, environment, platform, tech_stack, owner, criticality, last_synced_at)
asset_dependencies (id, asset_id, depends_on_asset_id, dependency_type, criticality)

-- Risk register
risks (id, tenant_id, plan_id, title, description, likelihood, impact, score, mitigation_section_id, status, owner)

-- Approval workflow
approval_workflows (id, plan_id, version_id, stage, status, current_approver, created_at)
approvals (id, workflow_id, approver_id, action, comment, signed_at)

-- Drills
drills (id, tenant_id, plan_id, scheduled_at, completed_at, status, participants, notes, ai_summary, actual_rto_minutes, actual_rpo_minutes, gaps_json)

-- Audit
audit_log (id, tenant_id, user_id, action, resource_type, resource_id, before_json, after_json, ip_address, user_agent, created_at)

-- AI usage
ai_usage_log (id, tenant_id, user_id, plan_id, section_id, provider, model, prompt_tokens, completion_tokens, cost_usd, created_at)
ai_configurations (id, tenant_id, name, provider, base_url, api_key_encrypted, default_model, is_default, settings_json)
```

**Key indexes:**
- `idx_plans_tenant_status (tenant_id, status)`
- `idx_sections_plan_order (plan_id, order)`
- `idx_audit_log_tenant_created (tenant_id, created_at desc)`
- `idx_ai_usage_tenant_month (tenant_id, created_at)`

---

## 9. UI/UX Design Principles

### 9.1 Design System

**Inspiration:** Linear, Notion, Vercel, Stripe — clean, modern, info-dense tapi tidak overwhelming.

| Element | Spec |
|---|---|
| **Typography** | Inter (UI), JetBrains Mono (code/tech) |
| **Color palette** | Slate base, Blue primary, Amber warning, Red critical, Green success |
| **Dark mode** | Default, switch ke light via toggle |
| **Spacing** | 4px grid (Tailwind default) |
| **Border radius** | 8px (cards), 6px (buttons), 4px (inputs) |
| **Shadows** | Subtle, layered (Tailwind `shadow-sm` to `shadow-xl`) |
| **Animation** | 150-300ms, ease-out, purpose-driven (no decoration) |
| **Iconography** | Lucide React (consistent with shadcn/ui) |

### 9.2 Information Architecture

```
/                            # Marketing landing (public)
/login, /signup              # Auth
/app                         # Authenticated shell
  /dashboard                 # Org overview: DRP status, drill schedule, alerts
  /plans                     # All DRPs list (filter: tier, status, service)
    /:planId                 # DRP detail
      /overview              # Summary, BIA, RTO/RPO
      /editor                # Section-by-section editor with AI co-pilot
      /versions              # Version history + diff
      /approvals             # Approval workflow status
      /drills                # Drill history + schedule
      /audit                 # Change log
  /assets                    # Asset registry + dependency graph
  /risks                     # Risk register
  /reports                   # Executive reports, compliance dashboard
  /settings
    /team                    # Members + roles
    /ai                      # AI provider configuration (CRITICAL)
    /billing
    /integrations
```

### 9.3 Key Screens (Wireframe Description)

**Screen 1: Dashboard (Home after login)**
- Top: Welcome + org name + global search
- 4 KPI cards: Total DRP, Approved, In Draft, Tested in last 12mo
- 2 charts: DRP by criticality tier (donut), Drill completion rate (bar)
- Activity feed: Recent changes, pending approvals, upcoming drills
- Quick actions: "+ New DRP", "Schedule drill", "Generate auditor package"

**Screen 2: Plan Editor (Main work area)**
- Left sidebar: Plan metadata (name, service, tier, RTO/RPO, status)
- Center: Section list dengan progress indicator (✓/in progress/empty)
  - Each section: title, content (Markdown WYSIWYG), AI suggestions side panel
  - AI panel: "Improve", "Add detail", "Translate", "Check consistency"
- Right sidebar: Comments, approvals, version history
- Top bar: Save (auto), Publish for review, Approve, Export

**Screen 3: AI Provider Config**
- Table: list of configured providers (name, type, model, is default, status)
- "+ Add provider" modal:
  - Type: OpenAI / Anthropic / Custom OpenAI-compatible / Custom Anthropic-compatible
  - Name, API key (encrypted, show only last 4)
  - Base URL (optional, placeholder)
  - Model (dropdown based on type, or free text for custom)
  - Test connection button
  - Save as default toggle
- Usage chart: token usage per provider per day

**Screen 4: Drill Scheduler**
- Calendar view (month/week)
- Click date → "Schedule drill" modal (select plan, participants, type)
- Past drills list dengan status (Scheduled, In Progress, Completed, Cancelled)
- Drill detail: timeline capture, post-drill report (AI-generated)

### 9.4 Aesthetic Direction

**Hero section (landing):**
- Full-width hero dengan animated gradient background (subtle blue → slate)
- Bold headline: "DRP yang teruji, terdokumentasi, dan patuh standar"
- Sub: "Bikin DRP 10x lebih cepat dengan AI co-pilot yang paham konteks, standar, dan best practice."
- 2 CTA: "Mulai gratis" + "Lihat demo"
- Below: 3-column feature highlight, social proof, customer logos, pricing teaser

**Empty states:** Illustrative SVG (bukan stock photo), encouraging copy, primary action.

**Loading states:** Skeleton (bukan spinner), optimistic update untuk known operations.

**Error states:** Friendly, specific (apa yang salah, gimana fix), retry button.

---

## 10. Implementation Roadmap

### Phase 1 — MVP (Bulan 1-3)

**Tujuan:** Bikin DRP pertama end-to-end tanpa AI.

**Scope:**
- F-01 sampai F-14 (core, no AI)
- Single template: NIST SP 800-34 (simplified)
- Single org, max 5 users
- Export PDF + DOCX
- Audit log basic

**Deliverable:** User bisa bikin DRP, edit section, submit approval, export PDF.

**Definition of Done:**
- [ ] User signup → onboard wizard → create first DRP dari template
- [ ] Edit 12 section (executive summary sampai lampiran) dengan Markdown editor
- [ ] Submit for review → Approver lihat di queue → Approve dengan e-sign
- [ ] Export PDF dengan cover, TOC, signatures
- [ ] Export DOCX editable
- [ ] Audit log capture semua perubahan
- [ ] vitest ≥ 80% coverage untuk business logic
- [ ] Deploy ke staging (cloud)

### Phase 2 — AI Co-pilot (Bulan 4-5)

**Tujuan:** AI assist untuk drafting & review.

**Scope:**
- F-20 sampai F-29 (AI features)
- 4 section dengan AI: executive summary, system description, risk, procedure
- Multi-provider (OpenAI, Anthropic, custom URL)
- Streaming response
- Token usage tracking

**Deliverable:** User bisa click "Generate" di section tertentu, AI draft real-time, user edit lalu save.

**Definition of Done:**
- [ ] Configure AI provider (OpenAI + Anthropic + 1 custom)
- [ ] Test connection works
- [ ] AI draft 4 section types dengan streaming
- [ ] Token usage logged per org
- [ ] Fallback: kalau AI fail, user bisa input manual
- [ ] Cost warning saat mendekati budget

### Phase 3 — Collaboration (Bulan 6-7)

**Tujuan:** Multi-user, real-time.

**Scope:**
- F-30 sampai F-34
- Comments dengan thread, mention, resolve
- Activity feed
- Email + in-app notification

**Deliverable:** Tim bisa collaborate di DRP yang sama secara real-time.

### Phase 4 — Enterprise (Bulan 8-10)

**Tujuan:** Drill, compliance, integrasi.

**Scope:**
- F-40 sampai F-50
- Drill scheduler + capture + AI report
- Risk register + asset registry
- Compliance mapping (NIST, ISO, BCI)
- Auditor package export
- Webhook + API
- SSO (Google, Microsoft)
- PWA offline mode
- White-label (P2)

**Deliverable:** Enterprise-ready, siap untuk organisasi 100+ user.

### Phase 5 — Scale (Bulan 11-12+)

- Mobile app (React Native atau PWA enhanced)
- Marketplace: share template antar org
- AI agent: proactive review (scheduled job, flag outdated)
- Integration marketplace: ServiceNow, Jira, Datadog, PagerDuty
- Multi-region, data residency per tenant

---

## 11. Pricing Model (Saran)

| Tier | User | Plans | AI tokens/mo | Price (IDR/bln) | Target |
|---|---|---|---|---|---|
| **Free** | 3 | 3 | 100K | 0 | Trial / SMB |
| **Starter** | 10 | 20 | 1M | 500K | SMB |
| **Pro** | 30 | 100 | 5M | 2.5M | Mid-market |
| **Enterprise** | Unlimited | Unlimited | Custom | Custom | Large org |

**AI cost margin:** Default 30% markup di atas provider cost. BYO API key = no markup.

---

## 12. Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI hallucination di DRP (generated content tidak valid) | High | High | Always human-in-the-loop, AI = draft, never auto-publish. Validation rules + consistency check. |
| AI cost blow-up (uncontrolled token usage) | Medium | High | Per-org rate limit, budget alert, BYO API key option. |
| Multi-tenant data leak | Low | Critical | RLS enforced di DB level, integration tests, regular audit. |
| Adoption rendah (user masih prefer Word) | Medium | High | Strong template library, free tier generous, success story showcase. |
| Compliance complexity (NIST/ISO/BCI) | Medium | Medium | Partner dengan auditor untuk validate mapping, quarterly update. |
| LLM provider outage | Low | Medium | Multi-provider support, fallback ke provider lain. |
| Indonesian language quality (model mix ID/EN) | Medium | Low | Curated prompt library, ID-specific testing. |

---

## 13. Technical Decisions Log

| # | Decision | Rationale | Alternative Considered |
|---|---|---|---|
| 1 | Vite + React (bukan Next.js) | Smaller bundle, lebih cocok untuk dashboard SaaS, consistency dengan ITResilience stack | Next.js (App Router) — heavier, lebih cocok untuk marketing site + app |
| 2 | PostgreSQL (bukan SQLite) | Multi-tenant SaaS butuh concurrent write, RLS, JSON columns | SQLite (single tenant) — too limiting |
| 3 | Vercel AI SDK (bukan LangChain) | Native multi-provider, streaming, function calling, simpler API | LangChain — too heavy, abstraction overhead |
| 4 | Drizzle ORM (bukan Prisma) | SQL-first, type-safe, lebih ringan, lebih dekat ke raw SQL | Prisma — heavier, generated client |
| 5 | Yjs + Hocuspocus (bukan Liveblocks) | Self-host friendly, no vendor lock-in, mature CRDT | Liveblocks — proprietary, paid |
| 6 | Fastify (bukan Express) | 2-3x faster, schema-first, plugin ecosystem | Express — older, slower |
| 7 | shadcn/ui (bukan Material UI / Ant Design) | Copy-paste (no dep lock-in), customizable, modern aesthetic | MUI / AntD — heavier, opinionated |
| 8 | BullMQ + Redis (bukan Cloudflare Queues) | Mature, support complex job patterns, dead letter queue | Cloudflare Queues — simpler tapi less flexible |

---

## 14. Open Questions (perlu decision sebelum implementasi)

1. **Hosting model:** Self-host full stack di Indonesia (compliance advantage) atau pakai global cloud (AWS/Cloudflare) dengan data residency config?
2. **Open source vs closed:** Open core (DRPBuilder core open, AI features paid) atau fully closed?
3. **BYO API key:** Mandatory dari awal atau gradual (free tier pakai default key, paid tier BYO)?
4. **First template:** NIST SP 800-34 (most common) atau ISO 22301 (international) atau BCI (UK, mature)?
5. **Pricing:** Confirm tiers di atas, terutama free tier limit (3 plans? 1? unlimited?).
6. **Branding:** Nama "DRPBuilder" working title, atau ada brand preference?

---

## 15. Success Criteria (Phase 1 MVP)

**Quantitative:**
- 50 org signup dalam 3 bulan post-launch
- 500 DRP created dalam 6 bulan
- 80% user bikin ≥1 DRP dalam 14 hari pertama
- AI draft success rate ≥ 95% (no error, no timeout)
- Page load P95 < 1.5s
- Test coverage ≥ 80%

**Qualitative:**
- User dapat bikin DRP dari 0 sampai approved dalam < 1 hari
- User merasa AI co-pilot "berguna", bukan gimmick
- Auditor dapat extract compliance evidence dalam < 10 menit
- Tim tidak perlu tanya "gimana format DRP yang bener" lagi

---

## 16. Referensi & Sumber

- NIST SP 800-34 Rev 1 — Contingency Planning Guide for Federal Information Systems
- ISO 22301:2019 — Business Continuity Management Systems
- BCI Good Practice Guidelines 2018
- ISO/IEC 27001:2022 — Annex A.17 (Information security aspects of business continuity)
- Vercel AI SDK docs — https://sdk.vercel.ai/docs
- shadcn/ui — https://ui.shadcn.com
- Drizzle ORM — https://orm.drizzle.team
- Yjs — https://yjs.dev

---

## 17. Lampiran

### Lampiran A: Glosarium

| Istilah | Definisi |
|---|---|
| **BIA** | Business Impact Analysis — analisis dampak bisnis jika service down |
| **DRP** | Disaster Recovery Plan — dokumen prosedur pemulihan |
| **RTO** | Recovery Time Objective — target waktu maksimal恢复 (menit/jam) |
| **RPO** | Recovery Point Objective — target data loss maksimal (menit/jam) |
| **Tier** | Criticality level (Tier 1 = paling kritis, Tier 4 = non-kritis) |
| **Hot Standby** | Recovery strategy: backup system running real-time |
| **Warm Standby** | Backup system running delayed (replication lag minutes) |
| **Cold Standby** | Backup system off, perlu di-spin up saat disaster |
| **DR Drill** | Test exercise untuk validasi DRP |
| **CRDT** | Conflict-free Replicated Data Type — untuk real-time collab |

### Lampiran B: Section List (NIST SP 800-34 simplified)

1. Ringkasan Eksekutif / Executive Summary
2. Pendahuluan / Introduction
3. Tujuan dan Scope / Purpose & Scope
4. Asumsi dan Kendala / Assumptions & Constraints
5. Konsep Operasional / Concept of Operations
6. Deskripsi Sistem / System Description
7. Penilaian Dampak Bisnis (BIA) / Business Impact Analysis
8. Strategi Pemulihan / Recovery Strategy
9. Rencana Komunikasi / Communication Plan
10. Kriteria Aktivasi / Activation Criteria
11. Prosedur Pemulihan / Recovery Procedures
12. Validasi dan Pengujian / Validation & Testing
13. Pemeliharaan Plan / Plan Maintenance
14. Lampiran / Appendices

---

**Dokumen ini adalah living document. Update setiap quarter atau setiap ada perubahan arsitektur signifikan.**

**Last updated:** 2026-06-20
**Next review:** 2026-07-20 (atau setelah Phase 1 kickoff)
