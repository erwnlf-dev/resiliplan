# ResiliPlan

> **Disaster Recovery Plan Builder — ISO 22301-aligned, AI-assisted, self-hosted**
> Monorepo untuk web app, API, dan shared types.

## Quick Start

```bash
# Install dependencies (uses pnpm workspaces)
pnpm install

# Start infrastructure (PostgreSQL + Redis)
pnpm docker:up

# Copy environment file
cp .env.example .env
# Edit .env with your secrets

# Run database migrations
pnpm db:migrate

# Start dev servers (web + api, parallel)
pnpm dev
```

**Open:**
- Web: http://localhost:5173
- API: http://localhost:3001
- API docs: http://localhost:3001/api/docs
- Health: http://localhost:3001/api/health
- Database UI (Drizzle Studio): `pnpm db:studio`

## Workspace Structure

```
resiliplan/
├── apps/
│   ├── web/              # Vite + React + TypeScript frontend
│   ├── api/              # Fastify + TypeScript backend
│   └── worker/           # (Phase 2+) BullMQ worker
├── packages/
│   └── shared/           # Shared types, constants, utilities
├── docs/                 # Documentation (PRD, architecture, etc)
├── scripts/              # Operational scripts (backup, restore test)
├── .github/              # GitHub workflows + templates
└── docker-compose*.yml   # Docker Compose files
```

## Documentation

| Doc | Description |
|---|---|
| [PRD.md](./PRD.md) | Master product requirements |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute |
| [docs/architecture.md](./docs/architecture.md) | Tech architecture detail |
| [docs/ai-integration.md](./docs/ai-integration.md) | AI layer design |
| [docs/data-model.md](./docs/data-model.md) | Drizzle schema detail |
| [docs/ui-design.md](./docs/ui-design.md) | Design system + screens |
| [docs/dr-plan.md](./docs/dr-plan.md) | Our own DR plan |
| [docs/threat-model.md](./docs/threat-model.md) | STRIDE analysis |
| [docs/runbook.md](./docs/runbook.md) | Common incident response |
| [docs/gap-analysis.md](./docs/gap-analysis.md) | Production readiness assessment |
| [docs/phase-0a-checklist.md](./docs/phase-0a-checklist.md) | Phase 0a DoD |

## Common Commands

```bash
# Development
pnpm dev                    # All workspaces in parallel
pnpm dev:api                # API only
pnpm dev:web                # Web only

# Build
pnpm build                  # All workspaces

# Test
pnpm test                   # All tests
pnpm test:coverage          # With coverage
pnpm test:watch             # Watch mode

# Lint & Format
pnpm lint                   # ESLint all
pnpm lint:fix               # Auto-fix
pnpm format                 # Prettier write
pnpm format:check           # Prettier check

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
```

## Tech Stack

- **Frontend:** Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Fastify + TypeScript + Drizzle ORM
- **Database:** PostgreSQL 16
- **Cache/Jobs:** Redis 7 + BullMQ
- **AI:** Vercel AI SDK (OpenAI, Anthropic, custom URL)
- **Auth:** Lucia Auth
- **Validation:** Zod
- **Testing:** Vitest
- **Deployment:** Docker Compose (self-hosted)

## License

[MIT](./LICENSE) — Open source
