# DRPBuilder — Technical Architecture

> Supporting doc untuk `PRD.md`. Deep dive ke teknologi, data model, dan AI integration.

## 1. Tech Stack Detail

### Frontend

| Package | Version | Purpose |
|---|---|---|
| `react` | ^18.3 | UI library |
| `react-dom` | ^18.3 | React DOM |
| `vite` | ^5.4 | Build tool, dev server |
| `typescript` | ^5.5 | Type safety |
| `react-router-dom` | ^6.26 | Routing |
| `@tanstack/react-query` | ^5.51 | Server state, caching |
| `zustand` | ^4.5 | Client state |
| `react-hook-form` | ^7.52 | Forms |
| `zod` | ^3.23 | Schema validation |
| `@hookform/resolvers` | ^3.9 | RHF + Zod integration |
| `tailwindcss` | ^3.4 | Styling |
| `shadcn-ui` (Radix UI) | latest | Component primitives |
| `lucide-react` | ^0.439 | Icons |
| `recharts` | ^2.12 | Charts (dashboard) |
| `react-markdown` | ^9.0 | Render markdown (section content) |
| `remark-gfm` | ^4.0 | GitHub-flavored markdown |
| `react-pdf` | ^9.1 | PDF preview (optional) |
| `yjs` | ^13.6 | CRDT for realtime collab |
| `y-websocket` | ^2.0 | Yjs websocket provider |
| `date-fns` | ^3.6 | Date utilities |
| `clsx` + `tailwind-merge` | latest | Conditional className |

### Backend

| Package | Version | Purpose |
|---|---|---|
| `fastify` | ^4.28 | HTTP server |
| `@fastify/cors` | ^9.0 | CORS |
| `@fastify/helmet` | ^11.1 | Security headers |
| `@fastify/rate-limit` | ^9.1 | Rate limiting |
| `@fastify/multipart` | ^8.3 | File upload (attachment, drill evidence) |
| `@fastify/static` | ^7.0 | Static file serving |
| `@fastify/jwt` | ^8.0 | JWT auth |
| `@fastify/websocket` | ^10.0 | WebSocket (Yjs sync) |
| `drizzle-orm` | ^0.33 | ORM |
| `drizzle-kit` | ^0.24 | Migration tool |
| `pg` | ^8.12 | PostgreSQL driver |
| `bcrypt` | ^5.1 | Password hash |
| `pino` | ^9.3 | Logger |
| `pino-pretty` | ^11.2 | Dev logger |
| `ai` (Vercel AI SDK) | ^3.2 | Multi-provider AI abstraction |
| `@ai-sdk/openai` | ^0.0.45 | OpenAI provider |
| `@ai-sdk/anthropic` | ^0.0.31 | Anthropic provider |
| `bullmq` | ^5.12 | Job queue |
| `ioredis` | ^5.4 | Redis client |
| `zod` | ^3.23 | Validation |
| `nanoid` | ^5.0 | ID generation |
| `puppeteer` | ^23.4 | HTML → PDF export |
| `docx` | ^8.5 | DOCX generation |
| `resend` | ^3.5 | Email (transactional) |
| `@sentry/node` | ^8.13 | Error tracking |
| `dotenv` | ^16.4 | Env loader |

### Dev / Test

| Package | Version | Purpose |
|---|---|---|
| `vitest` | ^2.0 | Test runner |
| `@vitest/coverage-v8` | ^2.0 | Coverage |
| `@testing-library/react` | ^16.0 | React testing |
| `@testing-library/user-event` | ^14.5 | User event simulation |
| `msw` | ^2.4 | API mocking |
| `supertest` | ^7.0 | HTTP testing |
| `eslint` | ^9.9 | Lint |
| `prettier` | ^3.3 | Format |
| `husky` | ^9.1 | Git hooks |
| `lint-staged` | ^15.2 | Pre-commit lint |

## 2. Folder Structure (Monorepo — Turborepo optional)

```
DRPBuilder/
├── apps/
│   ├── web/                          # Vite + React frontend
│   │   ├── src/
│   │   │   ├── routes/               # Route components
│   │   │   ├── components/           # Shared components
│   │   │   │   ├── ui/               # shadcn/ui primitives
│   │   │   │   ├── plan/             # Plan-specific
│   │   │   │   ├── editor/           # Section editor
│   │   │   │   └── ai/               # AI co-pilot components
│   │   │   ├── hooks/                # Custom React hooks
│   │   │   ├── lib/                  # Utilities
│   │   │   ├── stores/               # Zustand stores
│   │   │   ├── api/                  # API client (fetch + TanStack Query)
│   │   │   ├── types/                # Shared types
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── api/                          # Fastify backend
│       ├── src/
│       │   ├── routes/               # HTTP routes
│       │   │   ├── auth.ts
│       │   │   ├── orgs.ts
│       │   │   ├── plans.ts
│       │   │   ├── sections.ts
│       │   │   ├── bia.ts
│       │   │   ├── assets.ts
│       │   │   ├── risks.ts
│       │   │   ├── approvals.ts
│       │   │   ├── drills.ts
│       │   │   ├── ai.ts
│       │   │   ├── export.ts
│       │   │   └── webhook.ts
│       │   ├── services/             # Business logic
│       │   │   ├── plan-service.ts
│       │   │   ├── ai/
│       │   │   │   ├── provider-factory.ts
│       │   │   │   ├── prompt-templates.ts
│       │   │   │   ├── token-tracker.ts
│       │   │   │   └── cost-estimator.ts
│       │   │   ├── export/
│       │   │   │   ├── pdf-generator.ts
│       │   │   │   └── docx-generator.ts
│       │   │   └── ...
│       │   ├── db/                   # Drizzle schema + migrations
│       │   │   ├── schema/
│       │   │   │   ├── tenants.ts
│       │   │   │   ├── users.ts
│       │   │   │   ├── plans.ts
│       │   │   │   ├── sections.ts
│       │   │   │   ├── bia.ts
│       │   │   │   ├── assets.ts
│       │   │   │   ├── risks.ts
│       │   │   │   ├── approvals.ts
│       │   │   │   ├── drills.ts
│       │   │   │   ├── audit.ts
│       │   │   │   └── ai.ts
│       │   │   ├── migrations/
│       │   │   ├── client.ts
│       │   │   └── rls.ts            # Row-level security helpers
│       │   ├── auth/                 # Auth helpers
│       │   ├── jobs/                 # BullMQ job definitions
│       │   ├── ws/                   # WebSocket (Yjs Hocuspocus)
│       │   ├── middleware/
│       │   ├── config.ts
│       │   └── server.ts
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── shared/                       # Shared types between web & api
│       ├── src/
│       │   ├── types/
│       │   │   ├── plan.ts
│       │   │   ├── bia.ts
│       │   │   ├── ai.ts
│       │   │   └── ...
│       │   └── constants/
│       │       ├── templates.ts      # DRP template definitions
│       │       └── compliance.ts     # NIST/ISO/BCI mapping
│       └── package.json
│
├── docs/                             # Documentation
│   ├── PRD.md
│   ├── architecture.md (this file)
│   ├── data-model.md
│   ├── ai-integration.md
│   ├── ui-design.md
│   └── roadmap.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint + test on PR
│       └── deploy.yml                # Deploy on main
│
├── docker-compose.yml                # Local dev: postgres, redis, minio
├── turbo.json                        # Turborepo config (optional)
├── package.json                      # Root
└── README.md
```

## 3. Environment Variables

### Backend (`apps/api/.env`)

```bash
# Server
NODE_ENV=development
PORT=3001
HOST=0.0.0.0
BASE_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:5173

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/drpbuilder

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=<random-32-chars>
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# Storage (S3-compatible)
S3_ENDPOINT=http://localhost:9000  # MinIO local
S3_REGION=us-east-1
S3_BUCKET=drpbuilder-exports
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Email (Resend)
RESEND_API_KEY=re_xxx
EMAIL_FROM=DRPBuilder <[email protected]>

# Observability
SENTRY_DSN=https://xxx@sentry.io/xxx
LOG_LEVEL=info

# AI defaults (can be overridden per-org)
DEFAULT_AI_PROVIDER=openai
DEFAULT_AI_MODEL=gpt-4o-mini

# Encryption
API_KEY_ENCRYPTION_KEY=<32-byte-base64>
```

### Frontend (`apps/web/.env`)

```bash
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_APP_NAME=DRPBuilder
```

## 4. Key Workflows

### 4.1 Sign-up & Onboarding

```
1. User submits email + password + org name
2. API: create tenant + first user (Admin role)
3. Generate JWT (access + refresh)
4. Send welcome email
5. Frontend: redirect to onboarding wizard
   - Step 1: Confirm org name, industry, size
   - Step 2: Invite team members (optional)
   - Step 3: Choose first template (NIST / ISO / BCI)
   - Step 4: Create first DRP (or skip)
6. Land on dashboard
```

### 4.2 DRP Creation Flow

```
1. User clicks "+ New DRP" di dashboard
2. Modal: pilih service (existing asset) atau create new
3. Modal: pilih template (NIST default)
4. API: create plan (status=draft, version=1)
5. API: create empty sections dari template
6. Frontend: redirect to /app/plans/:planId/editor
7. User edit sections, save (auto-save every 30s)
8. AI panel: "Generate" button per section (if AI enabled)
9. User submit for review → status=in_review
10. Approver login → see in approval queue
11. Approver reviews, comments, approves
12. Plan status=approved, version published
13. Trigger webhook ke org's webhook config (if configured)
```

### 4.3 AI Section Draft Flow

```
1. User clicks "Generate" di section
2. Frontend: show loading skeleton + "AI is drafting..."
3. POST /api/ai/draft-section dengan { planId, sectionId, modelConfig? }
4. API:
   a. Load plan + section + context (asset, BIA, dependencies)
   b. Build prompt dari sectionPrompts[section.template]
   c. Resolve model dari modelConfig || org default
   d. Create model instance via createAIModel()
   e. streamText() dengan onFinish hook
5. Stream response to client via SSE
6. Frontend: render streaming content in editor
7. On finish:
   a. Save content as ai_suggested=true (user can edit before commit)
   b. Log token usage ke ai_usage_log
8. User reviews, edits, clicks "Accept" atau "Discard"
9. On Accept: save to section, clear ai_suggested
```

### 4.4 Multi-User Realtime Editing

```
1. User A opens plan editor
2. Frontend: open WebSocket ke /api/ws/plans/:planId
3. Hocuspocus server: authenticate via JWT, join Yjs room
4. User A edits section → Yjs op → broadcast to all clients in room
5. User B opens same plan → join room, receive current state
6. User B sees User A's cursor + edits in real-time
7. On save: explicit PATCH /api/plans/:planId/sections/:sectionId
   (Yjs is for collab, but DB is source of truth for persistence)
8. On disconnect: Yjs state synced to server, persisted to DB on next save
```

## 5. Security Architecture

### 5.1 Auth Flow

```
- Email + password: bcrypt(10 rounds) → store hash
- JWT: HS256, 7d access, 30d refresh, refresh rotated on use
- SSO (Phase 4): OAuth 2.0 OIDC untuk Google, Microsoft
- Session: stored in httpOnly secure cookie + Authorization header support
- CSRF: same-site strict cookie + token in double-submit pattern
- Rate limit: 5 login attempts / 15min / IP, 100 req/min / user
```

### 5.2 RBAC

| Role | Tenant | Org | Plan | Section | Asset | AI Config |
|---|---|---|---|---|---|---|
| Admin | C/R/U/D | C/R/U/D | C/R/U/D | C/R/U/D | C/R/U/D | C/R/U/D |
| Coordinator | R | R | C/R/U | C/R/U | C/R/U | C/R/U (no delete) |
| Owner | R | R | R/U (own) | R/U (own) | R/U (own) | R |
| Viewer | R | R | R | R | R | R |

### 5.3 Data Protection

- **At rest:** AES-256 (managed by cloud provider for DB + storage)
- **In transit:** TLS 1.3 everywhere
- **AI API keys:** Encrypted at rest with `API_KEY_ENCRYPTION_KEY` (AES-256-GCM)
- **PII:** No SSN, no payment data in app (payment via Stripe); email + name only
- **AI data:** When user configures BYO key, data goes directly to provider, not stored. Default key = data may be logged by provider (disclose in privacy policy)

### 5.4 Audit Trail

- Every write operation logged ke `audit_log`:
  - `user_id`, `tenant_id`, `action` (create/update/delete/approve/etc)
  - `resource_type`, `resource_id`
  - `before_json`, `after_json` (full diff)
  - `ip_address`, `user_agent`
  - `created_at`
- Log retention: 7 years (compliance default)
- Export: Admin can request CSV export of audit log per org

## 6. Performance Considerations

### 6.1 Database

- Indexes: `tenant_id`, `(tenant_id, status)`, `(plan_id, order)`, `(tenant_id, created_at desc)`
- Connection pool: max 20 per app instance (pg pool)
- Read replicas (Phase 4): for analytics queries
- Materialized views: for dashboard KPI (refresh hourly)

### 6.2 AI

- Streaming: reduce time to first token (TTFT) feel
- Context caching: cache common prompts (system prompt for section type) per org
- Batch: if user requests 5 sections, batch into 1 request (max 5 sections)
- Timeout: 30s default, 60s for procedure generation
- Cost guard: per-org daily budget alert, hard stop at 2x budget

### 6.3 Frontend

- Code splitting: route-level + component-level (React.lazy)
- TanStack Query: cache server state, dedupe identical requests
- Optimistic update: for save, comments, status change
- Debounce: for search, input → save (1s)
- Virtual scroll: for long list (plan list, drill list)

### 6.4 Realtime

- Yjs: small CRDT, sync via WebSocket
- Hocuspocus: persistence hook → save to DB on debounce
- Client limit: 100 concurrent editors per plan (Yjs is fine, but UI may lag)

## 7. Deployment

### 7.1 Local Dev (Docker Compose)

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: drpbuilder
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: drpbuilder
    ports: ['5432:5432']
    volumes: ['pgdata:/var/lib/postgresql/data']

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ['9000:9000', '9001:9001']
    volumes: ['miniodata:/data']

volumes:
  pgdata:
  miniodata:
```

### 7.2 Production (Phase 4+)

- **Frontend:** Cloudflare Pages (CDN, edge cache)
- **Backend:** Fly.io atau Railway (single region Asia-Southeast)
- **Database:** Neon (serverless Postgres, auto-scaling)
- **Redis:** Upstash (serverless, pay-per-request)
- **Storage:** Cloudflare R2 (S3-compatible, no egress fee)
- **Email:** Resend
- **Observability:** Sentry + Better Stack (logs)

### 7.3 CI/CD (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
```

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build --workspace=apps/api
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --config apps/api/fly.toml
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build --workspace=apps/web
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CF_PAGES_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          projectName: drpbuilder-web
          directory: apps/web/dist
```

## 8. Observability

### 8.1 Metrics (per service)

- Request count, latency (P50, P95, P99)
- Error rate (4xx, 5xx)
- DB query latency
- Redis hit rate
- AI token usage (per provider, per model)
- Job queue depth + processing time

### 8.2 Logs (structured JSON via Pino)

```json
{
  "level": "info",
  "time": "2026-06-20T10:40:00.000Z",
  "service": "drpbuilder-api",
  "traceId": "abc123",
  "userId": "u_xxx",
  "tenantId": "t_xxx",
  "route": "POST /api/plans",
  "statusCode": 201,
  "durationMs": 145,
  "msg": "plan created"
}
```

### 8.3 Traces (OpenTelemetry)

- Spans: HTTP request → DB query → AI call
- Sample rate: 100% for errors, 10% for success

### 8.4 Alerts

- Error rate > 5% (5min window)
- AI token usage > budget
- DB connection pool > 80%
- Job queue depth > 1000
- Disk usage > 80%
- API response P95 > 2s

---

**Last updated:** 2026-06-20
