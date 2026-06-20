# ResiliPlan — Disaster Recovery Plan Builder

> **Status:** PRD v1.1 — Master Grand Plan (revised 2026-06-20)
> **Author:** Erwin Alifiansyah · IT Service Resilience · PT Datacomm Diangraha
> **Repositori:** `~/ITResilience_Prod/ResiliPlan`
> **License:** Proprietary — All rights reserved (internal use + future commercial TBD)

---

## 1. Pendahuluan

### 1.1 Visi & Misi

**Visi (revised):** ResiliPlan adalah tool internal PT Datacomm Diangraha untuk membangun, menguji, dan memelihara Disaster Recovery Plan (DRP) yang patuh terhadap **ISO 22301** (sesuai compliance existing kantor), dengan referensi ke NIST SP 800-34 dan BCI GPG sebagai best practice global. Dikembangkan dengan kemungkinan komersialisasi di masa depan.

**Misi:** Mengubah DR planning dari proses dokumentasi statis yang berjam-jam menjadi workflow kolaboratif yang dibantu AI — dengan output yang siap-audit, dapat di-ekspor, dan dapat di-uji. Mempertahankan compliance ISO 22301 yang sudah ada di kantor.

### 1.1.1 Scope (revised)

- **Fase 0 (sekarang):** Self-hosted tool di public cloud server kantor. Single-tenant. Internal use only. ISO 22301 primary template.
- **Fase 1+ (future):** Mungkin dikembangkan komersial (lisensi, multi-tenant SaaS, paid tier). Keputusan komersial = separate discussion, belum diputuskan.

### 1.2 Problem Statement

DR planning di enterprise Indonesia masih menghadapi 6 masalah utama:

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

| Metric | Baseline (today) | Target (M6 internal) | Target (M12 if commercial) |
|---|---|---|---|
| Time to draft DRP per service | 2-4 minggu | 3-5 hari | 1-2 hari |
| DRP coverage (% critical service with approved DRP) | ~30% | 70% (internal) | 90% |
| DRP tested in last 12 months | ~30% | 50% | 80% |
| Auditor finding terkait DRP | 5-10/tahun | 2-3/tahun | 0-1/tahun |
| Plan update frequency | Every 2-3 tahun | Setiap ada perubahan infra | Auto-trigger |
| User satisfaction (internal team) | N/A | ≥ 7/10 | NPS ≥ 50 |

---

## 2. Solusi — ResiliPlan

### 2.1 Value Proposition

> "Bikin DRP 10x lebih cepat dengan AI co-pilot yang memahami konteks, standar, dan best practice. Setiap section ter-validasi compliance ISO 22301. Setiap perubahan ter-audit. Setiap tahun diuji drill dengan tracking real."

**Tagline:** *From static document to living plan.*

### 2.2 Differentiators vs Alternatif

| Capability | ResiliPlan | Word/Excel | Generic Doc (Notion/Confluence) | Enterprise BCM (Fusion, Archer) |
|---|---|---|---|---|
| AI Co-pilot per section | ✅ Built-in | ❌ | ❌ | ❌ |
| Multi-provider AI (OpenAI/Anthropic/custom) | ✅ BYO | ❌ | ❌ | ❌ |
| ISO 22301 compliance mapping | ✅ Auto | ❌ | ❌ | ✅ (manual) |
| NIST 800-34 + BCI GPG reference | ✅ Built-in | ❌ | ❌ | ✅ (manual) |
| Version control + diff | ✅ | ❌ | ✅ | ✅ |
| Approval workflow + e-sign | ✅ | ❌ | ❌ | ✅ |
| Drill scheduling + results | ✅ (Phase 4) | ❌ | ❌ | ✅ |
| Multi-tenant SaaS | ⏳ Future | ❌ | ❌ | ✅ |
| Bahasa Indonesia native | ✅ | ✅ | ❌ | ❌ |
| Self-hosted option | ✅ (default) | ✅ | ✅ | ❌ |
| Harga (SMB-friendly) | **Free** (internal now) | Free | $ | $$$$ |

### 2.3 High-level Capabilities

1. **AI-assisted drafting** — Generate section per section dengan context awareness. BYO API key multi-provider.
2. **Template library** — **ISO 22301 primary** (sesuai compliance existing), NIST SP 800-34 + BCI GPG reference.
3. **BIA (Business Impact Analysis)** — Structured form per service, hitung criticality tier.
4. **RTO/RPO calculator** — Berdasarkan tier, dependency, recovery strategy.
5. **Asset & dependency registry** — Linked to systems, services, third-party.
6. **Procedure library** — Reusable runbook (recover DB, restore VM, failover DNS).
7. **Risk register** — Link risk ke section mitigasi di DRP.
8. **Approval workflow** — Multi-stage: Draft → Review → Approve → Sign.
9. **Drill/test scheduler** — Schedule, capture hasil, update DRP dari learnings. (Phase 4)
10. **Audit trail** — Every change: who, when, what, why.
11. **Export** — PDF (formal), DOCX (editable), Markdown (git-friendly), JSON (interop).
12. **Collaboration** — Multi-user edit, comment, mention. (Phase 3)
13. **API & webhook** — Integrate dengan infra (CMDB, ITSM, monitoring). (Phase 4)
14. **Offline mode (PWA)** — Akses DRP saat incident tanpa internet. (Phase 4)

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

### 6.1 Stack Decision (Final — Self-hosted, Internal)

| Layer | Pilihan | Rationale |
|---|---|---|
| **Frontend** | Vite + React 18 + TypeScript | Fast HMR, mature, matches ITResilience stack |
| **UI Components** | shadcn/ui (Radix UI) + Tailwind CSS | Aesthetic, customizable, accessible |
| **State** | Zustand (client) + TanStack Query (server) | Lightweight, no Redux overhead |
| **Forms** | React Hook Form + Zod | Type-safe, performant |
| **Routing** | React Router v6 | Standard SPA |
| **Backend** | Fastify + TypeScript | Same as ITResCap & visual-agent-worker-saas, fast, schema-first |
| **Database** | PostgreSQL 16 (Docker di server kantor) | Compliance ISO 22301 butuh data on-prem, JSON columns fleksibel |
| **ORM** | Drizzle ORM | Type-safe, SQL-first, lightweight |
| **Auth** | Lucia Auth | Self-host friendly, no third-party dependency |
| **AI Layer** | Vercel AI SDK (`ai` package) | Multi-provider native: OpenAI / Anthropic / custom baseURL |
| **Job Queue** | BullMQ + Redis (Docker) | Background AI jobs, drill reminders, email send |
| **File Storage** | Local FS (server kantor) | Export PDF/DOCX, attachment, drill evidence. Path: `/var/lib/resiliplan/exports/` |
| **Email** | SMTP (mail kantor) | No external dependency, no cost |
| **Realtime** | Yjs + Hocuspocus (Phase 3) | CRDT for multi-user editing, self-host |
| **PDF Export** | Puppeteer (HTML→PDF) | High fidelity, customizable |
| **DOCX Export** | `docx` library | Programmatic generation |
| **Logging** | Pino (server) + console (client) | Fast, structured |
| **Observability** | Sentry (self-hosted atau free tier) | Error tracking |
| **Deployment** | Docker Compose di server kantor | Sesuai existing infra, no cloud cost |
| **CI/CD** | GitHub Actions → Docker image → manual deploy | Self-hosted, controlled release |
| **Reverse Proxy** | Nginx (existing di server) | TLS termination, static asset serving |
| **Backup** | Daily pg_dump ke local NAS | Disaster recovery our own infra |
| **SSL** | Let's Encrypt via certbot | Free, auto-renew |

### 6.2 Arsitektur (High-level) — Self-hosted

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React SPA + PWA)                                  │
│  ├── shadcn/ui components                                   │
│  ├── Zustand (client state)                                 │
│  ├── TanStack Query (server state, cache)                   │
│  ├── Yjs (CRDT realtime collab) — Phase 3                   │
│  └── Service Worker (offline mode) — Phase 4                │
└─────────────────────────────────────────────────────────────┘
                          │ HTTPS (Nginx TLS)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Server Public Cloud Kantor (single host, Docker Compose)   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Nginx (reverse proxy, TLS, static)                   │ │
│  │  └── Fastify API (Node.js + TypeScript)               │ │
│  │      ├── Routes: /auth, /plans, /sections, /bia, ...  │ │
│  │      ├── AI Service Layer (Vercel AI SDK)             │ │
│  │      │   ├── OpenAI (BYO key, custom baseURL)          │ │
│  │      │   ├── Anthropic (BYO key, custom baseURL)      │ │
│  │      │   ├── OpenAI-compatible (BYO URL + key)         │ │
│  │      │   └── Local LLM via Ollama (future)             │ │
│  │      ├── Job Producer (BullMQ)                         │ │
│  │      ├── PDF/DOCX Generator                            │ │
│  │      └── Static frontend build (served by Nginx)      │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ PostgreSQL   │  │ Redis        │  │ Local FS         │  │
│  │ 16           │  │ 7            │  │ /var/lib/        │  │
│  │ - plans      │  │ - jobs       │  │  resiliplan/     │  │
│  │ - sections   │  │ - cache      │  │  - exports/      │  │
│  │ - users      │  │ - sessions   │  │  - attachments/  │  │
│  │ - audit      │  │              │  │  - evidence/     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Backup: Daily pg_dump → NAS kantor                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │ HTTPS
                          ▼
                ┌──────────────────┐
                │ External AI APIs │
                │ (BYO key only)   │
                │ - OpenAI         │
                │ - Anthropic      │
                │ - Custom URL     │
                │ - Local LLM      │
                └──────────────────┘
```

**Single-tenant assumption:** All data di satu server, satu org (PT Datacomm Diangraha). User internal kantor via LDAP integration (Phase 1+) atau local user (Phase 0).

### 6.3 Multi-User (Single Tenant)

- **Strategy:** Single database, multi-user, RBAC.
- **Roles:** Admin, Coordinator, Owner, Viewer.
- **Auth:** Local user (Phase 0) + LDAP/SSO integration (Phase 1+).
- **Isolation:** User context di-extract dari session, enforced di Drizzle query helper.

**Future multi-tenant (if commercialized later):** Add `tenant_id` column + RLS. Backward compatible karena schema akan di-redesign untuk SaaS migration.

---

## 7. AI Integration Design (Deep Dive)

### 7.1 Kebutuhan (revised — BYO only)

**Setiap user configuration punya API key sendiri (BYO — Bring Your Own).** Tidak ada default key dari aplikasi. User pilih provider yang mereka punya akses:

- **OpenAI** — punya akun OpenAI, pakai gpt-4o, gpt-4o-mini, dll
- **Anthropic** — punya akun Anthropic, pakai claude-sonnet-4-5, claude-haiku-3-5, dll
- **OpenAI-compatible (custom URL)** — Together, Groq, OpenRouter, local llama.cpp, vLLM, Ollama, atau corporate gateway
- **Anthropic-compatible (custom URL)** — custom deployment Anthropic-format

**Kenapa BYO only:**
- Zero cost untuk app developer (saya tidak subsidize)
- User control penuh: model pilihan, cost control, data privacy
- User bisa pakai model yang dia sudah subscribe (misal punya langganan Cursor/Cody yang include API)
- Tiap user beda preferensi (beberapa suka OpenAI, beberapa Anthropic, beberapa local LLM untuk compliance)

### 7.2 Provider Abstraction Layer

Gunakan **Vercel AI SDK** (`ai` v4) yang native support multi-provider:

```typescript
// server/services/ai/provider-factory.ts
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelV1 } from 'ai';

export type AIProviderConfig = {
  provider: 'openai' | 'anthropic' | 'openai-compatible' | 'anthropic-compatible';
  apiKey: string;             // user-provided (BYO)
  baseURL?: string;           // custom endpoint
  model: string;              // e.g. 'gpt-4o', 'claude-sonnet-4-5', 'llama-3.1-70b'
  organization?: string;      // OpenAI org (optional)
  defaultHeaders?: Record<string, string>;  // corporate proxy headers
};

export function createAIModel(config: AIProviderConfig): LanguageModelV1 {
  switch (config.provider) {
    case 'openai':
    case 'openai-compatible':
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,  // undefined = default OpenAI
        organization: config.organization,
        headers: config.defaultHeaders,
      })(config.model);

    case 'anthropic':
    case 'anthropic-compatible':
      return createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.baseURL,  // undefined = default Anthropic
        headers: config.defaultHeaders,
      })(config.model);
  }
}
```

### 7.3 Per-User AI Configuration (Multi-Profile)

Karena BYO dan tiap user beda, support **multiple AI profiles per user**:

```typescript
// Each user can have multiple AI configs
type AIConfig = {
  id: string;
  user_id: string;            // belongs to specific user (not org-wide)
  name: string;               // "OpenAI Personal", "Anthropic Work", "Local Ollama"
  provider: 'openai' | 'anthropic' | 'openai-compatible' | 'anthropic-compatible';
  api_key_encrypted: string;  // AES-256-GCM
  base_url?: string;
  default_model: string;
  is_default: boolean;        // user's default
  enabled: boolean;
  settings: { temperature, max_tokens, ... };
};
```

**UX:**
- User buka Settings → AI Configurations
- "+ Add provider" modal: pilih type, isi API key, base URL (optional), model, test connection, save
- Tiap kali invoke AI, dropdown pilih config (atau pakai default)
- Token usage tracked per user per config (untuk cost awareness, bukan billing)

### 7.4 Prompt Templates per Section

Setiap section punya prompt template + context builder. Contoh:

```typescript
// server/services/ai/prompts/draft-section.ts
export const sectionPrompts = {
  'executive-summary': {
    system: `Anda adalah konsultan DR/BCP senior dengan 15+ tahun pengalaman.
Tulis executive summary DRP yang:
- 1 paragraf padat, maximum 200 kata
- Bahasa formal profesional Indonesia
- Cover: tujuan, scope, key recovery targets (RTO/RPO), recovery strategy, status approval
- Patuh ISO 22301 (clause 5-7 high-level structure)
- Action-oriented, bukan descriptive`,
    context: (plan) => ({
      planName: plan.name,
      serviceType: plan.service_type,
      criticalityTier: plan.tier,
      rto: plan.rto_minutes,
      rpo: plan.rpo_minutes,
      strategy: plan.recovery_strategy,
      isoCompliance: plan.iso_compliance_refs,  // auto-injected mapping
    }),
  },
  // ... dst
};
```

### 7.5 Streaming Implementation

```typescript
// server/routes/ai/draft-section.ts
import { streamText } from 'ai';

fastify.post('/api/ai/draft-section', async (req, reply) => {
  const { planId, sectionId, aiConfigId } = req.body;
  const userId = req.user.id;

  // Load context
  const plan = await planService.getPlan(planId);
  const section = await planService.getSection(sectionId);
  const aiConfig = await aiService.getConfig(userId, aiConfigId);

  // Build prompt
  const prompt = sectionPrompts[section.template_key];
  const ctx = prompt.buildContext(plan, section);
  const userPrompt = prompt.buildUserPrompt(ctx);

  // Create model from user's config
  const model = createAIModel({
    provider: aiConfig.provider,
    apiKey: aiService.decryptKey(aiConfig.api_key_encrypted),
    baseURL: aiConfig.base_url,
    model: aiConfig.default_model,
  });

  // Stream
  return streamText({
    model,
    system: prompt.system,
    prompt: userPrompt,
    onFinish: async (result) => {
      await aiService.logUsage({
        userId,
        planId,
        sectionId,
        provider: aiConfig.provider,
        model: aiConfig.default_model,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
      });
    },
  }).toDataStreamResponse();
});
```

### 7.6 Cost Awareness (Per-User Tracking)

Tidak ada billing (BYO = user bayar langsung ke provider). Tapi log usage untuk **awareness**:

- Per user, per config, per model
- Daily / monthly aggregation
- Dashboard widget: "This month you used 245K tokens with OpenAI gpt-4o (est. $2.45)"
- Alert kalau usage > threshold (configurable, default 1M tokens/bulan)

### 7.7 AI Features Mapping

| Section | AI Capability | Trigger |
|---|---|---|
| Executive Summary | Auto-draft (ISO 22301-aligned) | User click "Generate" |
| Scope | Auto-suggest scope items | New plan created |
| Assumptions | Consistency check | On save |
| Roles & Responsibilities | Suggest roles from local user list | On create |
| System Description | Auto-draft from asset metadata | Asset linked |
| Risk Assessment | Suggest risks from system type | New section |
| Recovery Strategy | Recommend strategy from BIA tier | BIA saved |
| Communication Plan | Template with org data | Template selection |
| Activation Criteria | Best practice injection (NIST + ISO) | On view |
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

**Pendekatan:** Build internal-use tool dulu, validasi dipakai internal, baru consider commercial. Phase di bawah reflect internal use case (PT Datacomm Diangraha).

### Phase 0 — Foundation (Bulan 1)

**Tujuan:** Setup project, deploy infra dasar, prove the build.

**Scope:**
- Repo `~/ITResilience_Prod/ResiliPlan` (rename dari `DRPBuilder`)
- Monorepo structure: `apps/web` (Vite+React), `apps/api` (Fastify), `packages/shared` (types)
- Docker Compose: PostgreSQL 16, Redis 7, Fastify API, Nginx reverse proxy
- Basic Fastify "hello world" + health check
- Vite React "hello world" + Tailwind + shadcn/ui setup
- Auth: Lucia Auth, local user (admin only initially)
- CI/CD: GitHub Actions lint + test + build (no deploy yet)

**Deliverable:** Bisa akses `https://resiliplan.kantor.local` (atau port forward), login sebagai admin, lihat dashboard kosong.

**Definition of Done:**
- [ ] `docker compose up` jalan tanpa error
- [ ] API health check returns 200
- [ ] Web app load di browser
- [ ] Login admin → dashboard
- [ ] Test coverage minimal (smoke test)
- [ ] Backup script (pg_dump) jalan daily via cron

### Phase 1 — Core DRP (Bulan 2-3)

**Tujuan:** Bikin DRP pertama end-to-end tanpa AI.

**Scope:**
- F-01 sampai F-14 (core, no AI)
- **Primary template: ISO 22301** (sesuai compliance existing), dengan NIST 800-34 + BCI GPG sebagai compliance mapping reference
- Single org, max 5 user (admin, coordinator, owner, viewer)
- Export PDF (cover, TOC, signature) + DOCX
- Audit log basic (every change captured)

**Deliverable:** User bisa bikin DRP ISO 22301-compliant, edit 14 section, submit approval, export PDF siap-audit.

**Definition of Done:**
- [ ] User login (admin/koordinator) → dashboard
- [ ] Create new DRP dari ISO 22301 template
- [ ] Edit 14 section dengan Markdown WYSIWYG editor
- [ ] AI-free drafting (user manual input + template skeleton)
- [ ] Compliance auto-mapping: section X → ISO 22301 clause Y (visual badge di UI)
- [ ] Submit for review → Approver approve dengan e-sign (simple text + timestamp)
- [ ] Export PDF dengan cover page, TOC, ISO compliance reference
- [ ] Export DOCX editable
- [ ] Audit log: every change tracked
- [ ] vitest ≥ 70% coverage business logic
- [ ] Deploy ke server kantor, accessible via internal URL

### Phase 2 — AI Co-pilot (Bulan 4-5)

**Tujuan:** AI assist untuk drafting & review. BYO only.

**Scope:**
- F-20 sampai F-29 (AI features)
- 4 section dengan AI: executive summary, system description, risk, procedure
- Per-user AI config (BYO key)
- Multi-provider: OpenAI, Anthropic, custom URL (Together, Groq, Ollama, dll)
- Streaming response
- Token usage tracking per user (awareness, no billing)

**Deliverable:** User bisa configure AI provider mereka sendiri, click "Generate" di section tertentu, AI draft real-time, user edit lalu save.

**Definition of Done:**
- [ ] Settings → AI Configurations UI
- [ ] Configure 3 types: OpenAI, Anthropic, OpenAI-compatible custom URL
- [ ] Test connection works (minimal request, verify response)
- [ ] AI draft 4 section types dengan streaming
- [ ] Token usage logged per user per config
- [ ] Cost awareness widget di dashboard
- [ ] Fallback: kalau AI fail, user bisa input manual
- [ ] Encryption: API key AES-256-GCM at rest

### Phase 3 — Collaboration (Bulan 6-7)

**Tujuan:** Multi-user, real-time edit.

**Scope:**
- F-30 sampai F-34
- Comments dengan thread, mention, resolve
- Activity feed
- Email + in-app notification
- Yjs + Hocuspocus untuk real-time collab

**Deliverable:** Tim bisa collaborate di DRP yang sama secara real-time, dengan comment thread.

### Phase 4 — Enterprise (Bulan 8-10) — IF going commercial

**Tujuan:** Drill, compliance, integrasi.

**Note:** Phase ini only relevant kalau ada decision untuk commercialize. Untuk internal use, beberapa fitur ini bisa di-skip atau di-simplify.

**Scope (subset for internal):**
- Drill scheduler + capture (simple: list, status, notes)
- Risk register (linked to plan section)
- Asset registry (linked to plan)
- Compliance mapping dashboard (visualisasi ISO 22301 coverage)
- Auditor package export (ZIP: DRP + drill history + change log)
- Webhook (CMDB change → DRP review notification)

**Scope (only if commercial):**
- SSO (Google, Microsoft)
- Multi-tenant
- Payment
- PWA offline mode
- White-label

### Phase 5 — Scale (Bulan 11-12+)

**Only if commercial decision made. Otherwise stop di Phase 4 internal.**

- Multi-region, data residency per tenant
- Mobile app
- Template marketplace
- Integration marketplace: ServiceNow, Jira, Datadog, PagerDuty
- AI agent: proactive review (scheduled job, flag outdated)

---

## 11. Pricing & Distribution (revised)

**ResiliPlan Free Edition (Phase 0-1) — Internal Use Only**

| Aspek | Detail |
|---|---|
| **Harga** | **GRATIS** untuk internal PT Datacomm Diangraha |
| **License** | Proprietary — All rights reserved (kantor), tidak untuk distribusi |
| **Distribution** | Self-hosted di server kantor, accessible via internal URL |
| **Support** | Internal (Erwin + tim) |
| **User limit** | Max ~20 user internal (untuk Phase 0-1) |
| **AI cost** | BYO — user bayar sendiri ke provider |

**Future Commercial (Phase 2+, NOT YET DECIDED):**

| Tier | Target | Harga (Saran) | Status |
|---|---|---|---|
| **Community** | Open source self-host | Free (MIT atau BUSL) | ⏳ TBD post-Phase 1 |
| **Pro** | SMB SaaS | $30-50/user/mo | ⏳ TBD post-Phase 1 |
| **Enterprise** | Large org | Custom | ⏳ TBD post-Phase 1 |

**Catatan:** Keputusan commercial = future discussion. Fokus sekarang: build internal tool, validate usage, get feedback, baru decide apakah mau SaaS-kan.

---

## 12. Risks & Mitigation (revised)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI hallucination di DRP (generated content tidak valid) | High | High | Always human-in-the-loop, AI = draft, never auto-publish. Validation rules + consistency check. ISO 22301 clause reference sebagai anchor. |
| AI cost blow-up (per-user) | Low | Low | BYO = user tanggung sendiri. App cuma log usage untuk awareness, no billing. |
| Self-hosted infra failure (server down) | Low | High | Backup daily ke NAS, restore RTO < 1h. Phase 1 use single server, monitor uptime. |
| Adoption rendah (user lebih prefer Word) | Medium | High | Strong template library ISO 22301, free, simple UX. Internal champion (DR coordinator) untuk promote. |
| ISO 22301 mapping akurasi rendah | Medium | High | Validate dengan auditor internal sebelum launch. Quarterly review. |
| LLM provider outage | Low | Medium | Multi-provider support (BYO), fallback ke provider lain / input manual. |
| Indonesian language quality (model mix ID/EN) | Medium | Low | Curated prompt library, ID-specific testing, instruct model untuk output ID. |
| API key bocor (encryption failure) | Low | Critical | AES-256-GCM dengan key dari env terpisah. Never log API key. Periodic key rotation. |
| User lupa save / concurrent edit conflict | Medium | Medium | Auto-save (Phase 3+), conflict detection, version history. |

---

## 13. Technical Decisions Log (Final)

| # | Decision | Rationale | Alternative Considered |
|---|---|---|---|
| 1 | Vite + React (bukan Next.js) | Smaller bundle, lebih cocok untuk internal dashboard, consistency dengan ITResilience stack | Next.js (App Router) — heavier, lebih cocok untuk marketing site |
| 2 | PostgreSQL 16 (bukan SQLite) | Compliance ISO 22301 butuh proper DB, concurrent write, JSON columns, full SQL | SQLite — too limiting untuk production |
| 3 | Vercel AI SDK (bukan LangChain) | Native multi-provider, streaming, function calling, simpler API | LangChain — too heavy, abstraction overhead |
| 4 | Drizzle ORM (bukan Prisma) | SQL-first, type-safe, lebih ringan, lebih dekat ke raw SQL | Prisma — heavier, generated client |
| 5 | Yjs + Hocuspocus (bukan Liveblocks) | Self-host friendly, no vendor lock-in, mature CRDT | Liveblocks — proprietary, paid |
| 6 | Fastify (bukan Express) | 2-3x faster, schema-first, plugin ecosystem, sama dengan visual-agent-worker-saas | Express — older, slower |
| 7 | shadcn/ui (bukan Material UI / Ant Design) | Copy-paste (no dep lock-in), customizable, modern aesthetic, accessible | MUI / AntD — heavier, opinionated |
| 8 | BullMQ + Redis (bukan Cloudflare Queues) | Mature, support complex job patterns, dead letter queue, self-host | Cloudflare Queues — simpler tapi less flexible |
| 9 | Monorepo (Turborepo) untuk apps/web + apps/api + packages/shared | Type sharing antara FE & BE, simpler refactor, single CI | Separate repos — overhead |
| 10 | Self-hosted Docker Compose (bukan Kubernetes) | Single server internal, simpler ops, less infrastructure-as-code overhead | K8s — overkill untuk internal tool |
| 11 | ISO 22301 primary template (bukan NIST 800-34) | Kantor sudah comply ISO 22301, mapping NIST + BCI sebagai reference | NIST 800-34 — US-centric, less applicable |
| 12 | BYO AI key only (bukan default key) | Zero cost ke app developer, user control, multi-provider flexibility | Default key + billing — overhead, low margin |
| 13 | Proprietary license (bukan open source) | Initial scope internal, commercialization TBD, semua rights reserved | Open source (MIT/AGPL) — premature decision |
| 14 | Single tenant (bukan multi-tenant) | Internal use only, simpler data model, faster MVP | Multi-tenant — premature, schema akan di-redesign kalau commercial |
| 15 | Local FS storage (bukan S3) | Self-hosted, no external dependency, simpler | S3-compatible — butuh extra service, overkill untuk internal |

---

## 14. Locked Decisions (was Open Questions — resolved 2026-06-20)

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | Hosting model | **Self-host di public cloud server kantor** (existing infra) | Data on-prem, compliance advantage, no cloud cost, internal use only |
| 2 | Open source vs closed | **Open source — MIT License** | Push ke GitHub sebagai free source. MIT = permissive, enterprise-friendly, max adoption |
| 3 | BYO API key | **BYO only, no default key** | Zero cost ke app, user control, multi-provider flexibility. User config per-user (multiple profile) |
| 4 | First template | **ISO 22301 primary** + NIST 800-34 + BCI GPG sebagai compliance mapping reference | Kantor sudah comply ISO 22301. NIST + BCI sebagai best-practice global references |
| 5 | Pricing | **Free, open source, internal use first** | Build internal tool, validate, push ke GitHub sebagai free source. Commercial = future decision post-public-launch |
| 6 | Branding | **ResiliPlan** | Verified memorable, descriptive, unique. Domain + trademark check masih perlu dilakukan |

**License details (MIT):**
- Free untuk personal, commercial, modification, distribution
- Patent grant implicit (MIT License)
- No copyleft (vs AGPL/GPL) — easier enterprise adoption
- Compatible dengan hampir semua proprietary code (permissive)
- Trademark: "ResiliPlan" nama bisa di-trademark terpisah (TBD)

**Action items (pending):**
- [ ] Check domain `resiliplan.com`, `resiliplan.id`, `resiliplan.co` availability
- [ ] Check trademark (USPTO + DJKI Indonesia)
- [ ] Create GitHub repo: `datacomm-diangraha/resiliplan` (or personal)
- [ ] Logo design (bold wordmark + simple icon)
- [ ] Verify all dependency licenses compatible dengan MIT
- [ ] Audit gap analysis `docs/gap-analysis.md` → execute P0 actions sebelum public release

**Production readiness reference:** Lihat [`docs/gap-analysis.md`](./docs/gap-analysis.md) untuk comprehensive gap analysis vs production best practice. Top 10 P0 actions harus di-execute sebelum public GitHub release (~30 hours work).

---

## 15. Success Criteria (Phase 1 MVP — Internal)

**Quantitative:**
- 5+ DRP created di internal (PT Datacomm) dalam 3 bulan post-launch
- 70% critical service punya approved DRP dalam 6 bulan
- Time to draft DRP per service turun dari 2-4 minggu ke 3-5 hari
- ISO 22301 compliance check pass di internal audit
- Page load P95 < 1.5s
- Test coverage ≥ 70%
- Backup daily ke NAS jalan tanpa missed day
- Uptime ≥ 99% (allow 7.2h downtime/bulan untuk maintenance)

**Qualitative:**
- DR Coordinator bisa bikin DRP dari 0 sampai approved dalam < 5 hari
- Auditor internal bisa verify ISO 22301 compliance dalam < 1 jam
- Tim tidak perlu tanya "gimana format DRP yang bener" lagi
- AI co-pilot (Phase 2) bikin drafting terasa "scaffolding" bukan "gimmick"

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

### Lampiran B: Section List (ISO 22301-aligned)

Section list untuk template ISO 22301 (primary), dengan mapping ke NIST SP 800-34 + BCI GPG sebagai reference:

| # | Section (ID) | ISO 22301 Clause | NIST 800-34 Ref | BCI GPG Ref |
|---|---|---|---|---|
| 1 | Ringkasan Eksekutif / Executive Summary | 4.3 Scope, 5.2 Policy | Section 1 (Exec Summary) | Section 2.1 |
| 2 | Pendahuluan / Introduction | 4.1 Understanding org | Section 1 (Intro) | Section 2.2 |
| 3 | Tujuan dan Scope / Purpose & Scope | 4.3 Scope | Section 1 (Purpose & Scope) | Section 2.3 |
| 4 | Asumsi dan Kendala / Assumptions & Constraints | 4.4 Context | Section 1 (Assumptions) | Section 2.4 |
| 5 | Konsep Operasional / Concept of Operations | 5.3-5.7 Planning | Section 2 (Concept of Operations) | Section 3 |
| 6 | Deskripsi Sistem / System Description | 4.4 Context (interested parties) | Section 3 (System Description) | Section 3.1 |
| 7 | Penilaian Dampak Bisnis (BIA) / Business Impact Analysis | 8.2 BIA | Section 4 (BIA) | Section 4.1 |
| 8 | Strategi Pemulihan / Recovery Strategy | 8.3-8.5 BC strategy | Section 5 (Recovery Strategy) | Section 4.2 |
| 9 | Rencana Komunikasi / Communication Plan | 7.4 Communication | Section 6 (Communication) | Section 5.1 |
| 10 | Kriteria Aktivasi / Activation Criteria | 8.5 BC procedures | Section 6 (Activation) | Section 5.2 |
| 11 | Prosedur Pemulihan / Recovery Procedures | 8.5 BC procedures | Section 7 (Procedures) | Section 5.3 |
| 12 | Validasi dan Pengujian / Validation & Testing | 9.3 Management review, 8.6 Testing | Section 8 (Testing) | Section 6 |
| 13 | Pemeliharaan Plan / Plan Maintenance | 10.1 Continual improvement, 9.2 Internal audit | Section 9 (Maintenance) | Section 7 |
| 14 | Lampiran / Appendices | (varying) | Appendix A-D | Section 8 |

---

**Dokumen ini adalah living document. Update setiap quarter atau setiap ada perubahan arsitektur signifikan.**

**Last updated:** 2026-06-20
**Next review:** 2026-07-20 (atau setelah Phase 1 kickoff)
