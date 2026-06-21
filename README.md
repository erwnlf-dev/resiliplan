# ResiliPlan

> **Disaster Recovery & Business Continuity Plan Builder — ISO 22301-aligned, AI-assisted, self-hosted, multi-tenant whitelabel.**
>
> Monorepo untuk web app, API, dan shared types. Dirancang untuk organisasi yang ingin mengelola program BC/DR secara terstruktur dengan standar ISO 22301, NIST 800-34, dan BCI GPG — dengan AI sebagai co-pilot.

![Status](https://img.shields.io/badge/status-internal%20ready-0F4C81)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-339933)
![pnpm](https://img.shields.io/badge/pnpm-9.x-F69220)
![Postgres](https://img.shields.io/badge/postgres-16-336791)

---

## ✨ Highlights

- **ISO 22301-aligned** — 14 section template siap pakai (Context, Leadership, Planning, BIA, Risk, Strategy, Procedure, Communication, Validation, Exercise, Performance, Improvement, dst.)
- **AI-assisted authoring** — generate plan skeleton, recovery steps, test scenarios, dan strategy recommendations. Provider-agnostic (default: Hermes via tokenrouter, support OpenAI/Anthropic/custom URL)
- **Multi-tenant whitelabel** — tiap tenant punya branding sendiri (logo, warna, footer). Document export siap pakai nama perusahaan
- **BIA built-in** — 15 template untuk critical service tiers, CSV import, tier 1-4 derivation otomatis
- **DR plan builder** — Markdown editor dengan section status grid, snippet library, autosave, plan quality score
- **Audit-ready exports** — PDF report dengan cover page, classification badge, document control
- **Production-grade** — PostgreSQL, Redis, BullMQ, structured logging, backup otomatis harian, restore-tested

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx (:8080)                        │
│              public reverse proxy + TLS                 │
└─────────────┬───────────────────────────┬───────────────┘
              │ /                          │ /api, /collab
              ▼                            ▼
    ┌──────────────────┐         ┌──────────────────────┐
    │   Web (Vite SPA) │         │   API (Fastify)      │
    │   React 18 + TS  │         │   TypeScript         │
    │   port 5173      │         │   port 3001          │
    └──────────────────┘         └──────────┬───────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          ▼                  ▼                  ▼
                  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
                  │ PostgreSQL 16│   │   Redis 7    │   │  AI Provider │
                  │  primary DB  │   │  cache+jobs  │   │  (Hermes /   │
                  │              │   │              │   │   OpenAI /   │
                  │              │   │              │   │   custom)    │
                  └──────────────┘   └──────────────┘   └──────────────┘
                                             │
                                             ▼
                                  ┌──────────────────┐
                                  │  Collab Server   │
                                  │  port 3002       │
                                  └──────────────────┘
```

**Process management**: PM2 (`ecosystem.config.js`)

---

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 20
- pnpm 9.x (`npm i -g pnpm`)
- Docker + Docker Compose (untuk PostgreSQL & Redis)
- 1 vCPU, 2GB RAM minimum (2 vCPU + 4GB untuk production)

### Development

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (PostgreSQL + Redis)
pnpm docker:up

# 3. Copy environment file
cp .env.example .env
# Edit .env — set DATABASE_URL, AI provider key, session secret

# 4. Run database migrations
pnpm db:migrate

# 5. Seed default tenant + admin user
pnpm db:seed

# 6. Start dev servers (web + api in parallel)
pnpm dev
```

**Open**:
- Web: <http://localhost:5173>
- API: <http://localhost:3001>
- API docs: <http://localhost:3001/api/docs>
- Health: <http://localhost:3001/api/health>
- Drizzle Studio: `pnpm db:studio`

**Default admin**: `admin@resiliplan.local` / password from `pnpm db:seed` output (ganti segera setelah login pertama).

### Production (self-hosted)

```bash
# 1. Build semua workspace
pnpm build

# 2. Setup database + AI provider
cp .env.example .env
# Edit .env untuk production (lihat .env.example untuk semua keys)
pnpm db:migrate

# 3. Start dengan PM2
pnpm pm2:start    # atau: pm2 start ecosystem.config.js

# 4. Setup Nginx reverse proxy (port 80/443 → 8080)
# Lihat docs/nginx-reverse-proxy.md

# 5. Setup daily backup cron
bash scripts/install-backup-cron.sh
```

**Layanan**:

| Service | Port | Process |
|---------|------|---------|
| Nginx (public) | 8080 | `nginx` |
| Web (Vite SPA) | 5173 | `pm2: resiliplan-web` |
| API (Fastify) | 3001 | `pm2: resiliplan-api` |
| Collab (Yjs) | 3002 | `pm2: resiliplan-collab` |
| PostgreSQL | 5432 | docker |
| Redis | 6379 | docker |

---

## 📁 Workspace Structure

```
resiliplan/
├── apps/
│   ├── web/                    # Vite + React 18 + TypeScript frontend
│   │   ├── src/
│   │   │   ├── pages/          # Route components
│   │   │   ├── components/     # Reusable UI (design system primitives)
│   │   │   ├── lib/            # API client, hooks, utils
│   │   │   └── App.tsx         # Shell + routing
│   │   └── public/
│   ├── api/                    # Fastify + TypeScript backend
│   │   ├── src/
│   │   │   ├── routes/         # HTTP handlers (REST)
│   │   │   ├── services/       # Business logic
│   │   │   ├── drp/            # ISO 22301 section templates
│   │   │   ├── ai/             # AI provider abstraction
│   │   │   ├── db/             # Drizzle schema + migrations
│   │   │   └── lib/            # Shared utilities
│   │   └── scripts/            # Backup, restore, maintenance
│   ├── collab/                 # Yjs collaboration server
│   └── worker/                 # (future) BullMQ heavy jobs
├── packages/
│   └── shared/                 # Shared types, constants, utilities
├── docs/                       # Architecture, runbook, DR plan, threat model
├── scripts/                    # Operational scripts (backup, cleanup, restore)
├── .github/                    # Workflows + issue/PR templates
├── docker-compose*.yml
└── ecosystem.config.js         # PM2 process definitions
```

---

## 🧰 Tech Stack

| Layer | Stack |
|-------|-------|
| **Frontend** | Vite 5, React 18, TypeScript, custom design system (CSS variables, <10KB gz), pure SVG charts |
| **Backend** | Fastify 4, TypeScript, Drizzle ORM 0.30+ |
| **Database** | PostgreSQL 16 |
| **Cache/Jobs** | Redis 7, BullMQ 5 |
| **Auth** | Custom session-based (Lucia-style, PostgreSQL-backed) |
| **AI** | Provider-agnostic (Hermes/OpenAI/Anthropic/custom URL), Vercel AI SDK 3 |
| **Validation** | Zod 3 |
| **Collab** | Yjs 13, y-websocket |
| **Testing** | Vitest 1, Supertest |
| **PDF Export** | weasyprint + pandoc |
| **Process** | PM2 |
| **Reverse Proxy** | Nginx |
| **Container** | Docker Compose |

---

## 📖 Documentation

| Doc | Description |
|---|---|
| [PRD.md](./PRD.md) | Master product requirements (50+ pages) |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute, commit conventions |
| [SECURITY.md](./SECURITY.md) | Security policy + disclosure |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Community guidelines |
| [docs/architecture.md](./docs/architecture.md) | Tech architecture detail |
| [docs/ai-integration.md](./docs/ai-integration.md) | AI layer design, provider config |
| [docs/integrations.md](./docs/integrations.md) | Open source integrations (NetBox, Prometheus, Mattermost, etc) |
| [docs/data-model.md](./docs/data-model.md) | Drizzle schema + ERD |
| [docs/ui-design.md](./docs/ui-design.md) | Design system + screen catalog |
| [docs/dr-plan.md](./docs/dr-plan.md) | ResiliPlan's own DR plan (meta-DR) |
| [docs/threat-model.md](./docs/threat-model.md) | STRIDE analysis |
| [docs/runbook.md](./docs/runbook.md) | Common incident response procedures |
| [docs/gap-analysis.md](./docs/gap-analysis.md) | Production readiness assessment |
| [docs/internal-production-release-packet.md](./docs/internal-production-release-packet.md) | Internal release runbook |
| [docs/nginx-reverse-proxy.md](./docs/nginx-reverse-proxy.md) | Nginx + TLS setup |
| [docs/phase-0a-checklist.md](./docs/phase-0a-checklist.md) | Phase 0a DoD |

---

## 🎯 Fitur Unggulan

### Open Source Integrations
ResiliPlan dirancang untuk "integrate, not replace". Built-in support untuk 14+ open source tools:

**Source (pull data INTO ResiliPlan):**
- **NetBox** (CMDB) — auto-populate BIA dari device inventory, RTO/RPO by tier
- **Acronis Cyber Protect** (Datacomm Cloud Backup) — auto-populate BIA + RPO verification dari real protected workloads
- **Prometheus Alertmanager** — SLA breach detection via webhook
- **Keycloak / Authentik** (SSO) — OIDC enterprise auth
- **BorgBackup / restic** — backup verification

**Sink (push data FROM ResiliPlan):**
- **Mattermost / Rocket.Chat** — ChatOps notification
- **Cstate** (status page) — auto-update saat plan activated
- **BookStack** — publish plan section ke wiki
- **Grafana** — annotations + status sync

**Bidirectional (both):**
- **GLPI / Zammad / osTicket** (ITSM) — incident → plan, plan → ticket
- **Rundeck** — trigger runbook job dari plan steps
- **n8n** — workflow automation orchestrator
- **Eramba** (GRC) — push ISO 22301 evidence

**Generic:** Custom webhook untuk homegrown systems (HMAC-SHA256 signed).

Setup via **Settings → Integrations** atau API:
```
POST /api/v1/integrations          # Create
GET  /api/v1/integrations          # List (secrets masked)
POST /api/v1/integrations/:id/sync # Trigger sync
GET  /api/v1/integrations/catalog  # Supported types
POST /api/v1/webhooks/in/prometheus # Inbound webhook
```

### ISO 22301 Plan Builder
14 section template sesuai ISO 22301:2019 + BCI GPG + NIST 800-34. Tiap section punya:
- Status tracking (draft / in-review / approved)
- Owner assignment
- Review schedule
- Linked evidence (PDF, image, link)
- Version history

### AI Co-Pilot
- **Plan skeleton generation** — generate 14 section draft dari service name + criticality (60-75s, full ISO format)
- **Recovery steps** — step-by-step runbook untuk specific service
- **Test scenarios** — tabletop + functional test draft
- **BIA analysis** — analyze BIA entries, suggest tier
- **Risk mitigation** — risk treatment recommendations
- **Strategy recommendation** — cold/warm/hot standby comparison
- **Streaming suggestions** — inline content assistance

### Business Impact Analysis (BIA)
- 15 template siap pakai (cloud, on-prem, hybrid, SaaS, IoT, dll)
- Tier 1-4 derivation otomatis dari RTO/RPO + dependency count
- CSV import bulk
- Aligned check ke DR plan (auto-flag BIA tanpa DRP)

### Whitelabel Branding
Per-tenant branding via `tenants.settings.branding`:
- Company name + tagline
- Logo (PNG/JPG/SVG, base64)
- Primary + accent color
- Document classification (public/internal/confidential/restricted)
- Custom footer + document prefix
- `hidePlatformBranding` toggle (default: true)

Semua exported document (PDF) otomatis pakai branding tenant.

### Audit & Compliance
- Plan quality score (0-100) dengan signal breakdown
- Approval workflow
- Audit log per plan
- Document control section di exported PDF
- Classification badge otomatis

---

## 🛠️ Common Commands

```bash
# Development
pnpm dev                    # All workspaces in parallel
pnpm dev:api                # API only
pnpm dev:web                # Web only

# Build
pnpm build                  # All workspaces
pnpm build:web              # Web only
pnpm build:api              # API only

# Test
pnpm test                   # All tests
pnpm test:coverage          # With coverage
pnpm test:watch             # Watch mode

# Lint & Format
pnpm lint                   # ESLint all
pnpm lint:fix               # Auto-fix
pnpm format                 # Prettier write
pnpm format:check           # Prettier check
pnpm typecheck              # TypeScript check all

# Database
pnpm db:generate            # Generate migration from schema
pnpm db:migrate             # Apply migrations
pnpm db:push                # Push schema directly (dev only)
pnpm db:studio              # Open Drizzle Studio
pnpm db:seed                # Seed dev data

# Docker
pnpm docker:up              # Start infrastructure
pnpm docker:down            # Stop infrastructure
pnpm docker:logs            # Tail logs
pnpm docker:reset           # Reset (DESTRUCTIVE: drops all data)

# Production ops
pnpm pm2:start              # Start all PM2 processes
pnpm pm2:stop               # Stop all
pnpm pm2:restart            # Restart
pnpm pm2:logs               # Tail logs
pnpm pm2:status             # Process status

# Backup
pnpm backup                 # Manual backup
bash scripts/install-backup-cron.sh   # Install daily 03:00 cron
```

---

## 🔐 Environment Variables

Lihat [`.env.example`](./.env.example) untuk template lengkap. Wajib di-set:

| Key | Description | Example |
|-----|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@localhost:5432/resiliplan` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `SESSION_SECRET` | Session signing key (32+ char) | `[generate random]` |
| `ENCRYPTION_KEY` | Secret encryption key (32 hex) | `[generate random]` |
| `PORT` | API port | `3001` |
| `WEB_PORT` | Web port | `5173` |
| `COLLAB_PORT` | Collab port | `3002` |
| `VITE_API_URL` | Web → API URL | `http://localhost:3001` |
| `LOG_LEVEL` | Pino log level | `info` |
| `NODE_ENV` | Environment | `production` |
| `CORS_ORIGINS` | Allowed CORS origins (comma) | `http://localhost:5173` |

**AI provider** (salah satu):

```bash
# Option 1: Hermes via tokenrouter (default)
AI_PROVIDER=hermes
AI_BASE_URL=https://api.tokenrouter.com/v1
AI_API_KEY=sk-...
AI_MODEL=MiniMax-M3

# Option 2: OpenAI
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_MODEL=gpt-4o

# Option 3: Custom OpenAI-compatible
AI_PROVIDER=custom
AI_BASE_URL=https://your-endpoint/v1
AI_API_KEY=...
AI_MODEL=your-model
```

**SMTP** (optional, untuk email):

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=...
SMTP_PASS=...           # App password untuk Gmail
SMTP_FROM_NAME=ResiliPlan
```

---

## 🚢 Deployment

Lihat [docs/internal-production-release-packet.md](./docs/internal-production-release-packet.md) untuk runbook lengkap.

**TL;DR**:
1. Provision VM (Ubuntu 22.04+, 2 vCPU + 4GB RAM minimum)
2. Install Docker, Node 20, pnpm 9, PM2, Nginx
3. Clone repo
4. `pnpm install && pnpm build`
5. Setup `.env` + `pnpm db:migrate`
6. `pm2 start ecosystem.config.js`
7. Configure Nginx reverse proxy + TLS (Let's Encrypt)
8. Setup backup cron
9. Verify: `curl http://localhost:8080/api/health`

**Internal release packet** includes:
- Pre-deployment checklist
- Schema migration procedure
- Zero-downtime deploy steps
- Rollback procedure
- Post-deploy smoke test
- Incident response

---

## 🧪 Testing

```bash
pnpm test                  # All tests (Vitest)
pnpm test:coverage         # Coverage report
pnpm test:watch            # Watch mode
```

**Test stack**: Vitest 1 + Supertest (API integration) + @testing-library/react (web component).

**CI**: GitHub Actions (`.github/workflows/ci.yml`) — typecheck, lint, test, build di tiap PR.

---

## 🤝 Contributing

Lihat [CONTRIBUTING.md](./CONTRIBUTING.md) untuk:
- Commit message convention (Conventional Commits)
- PR workflow
- Code style (Prettier + ESLint)
- Testing requirements
- Security disclosure

---

## 🔒 Security

Lihat [SECURITY.md](./SECURITY.md) untuk security policy dan disclosure process.

**Known security features**:
- Session-based auth dengan HttpOnly + SameSite cookies
- CSRF protection
- Argon2id password hashing
- Encrypted SMTP credentials (AES-256-GCM di db)
- SQL injection prevention (Drizzle ORM parameterized queries)
- Rate limiting (per-IP, per-endpoint)
- Audit log untuk plan changes

**Roadmap**: SOC2 Type I (Q3 2026), MFA untuk admin, secrets rotation automation.

---

## 📊 Project Status

**Current**: Internal-ready, production-deployed di PT Datacomm Diangraha IT Service Resilience.
**Coverage**: ~70% (test), 22 commits, 9 AI endpoints, 14 ISO sections, multi-tenant whitelabel.
**Bundle**: CSS 9.14KB gz, JS 75.97KB gz.
**Performance**: Plan skeleton generation 60-75s, other AI endpoints 6-13s.

---

## 📜 License

[MIT](./LICENSE) — Open source, bebas digunakan untuk internal / komersial dengan attribution.

---

## 🙏 Credits

- **ISO 22301:2019** — Security and resilience business continuity management systems
- **NIST SP 800-34 Rev. 2** — Contingency Planning Guide for Federal Information Systems
- **BCI Good Practice Guidelines 2018**
- **Yjs** — CRDT for collaboration
- **Drizzle ORM** — TypeScript ORM
- **Fastify** — HTTP framework

---

**Maintained by**: PT Datacomm Diangraha — IT Service Resilience
**Contact**: Erwin Alifiansyah
