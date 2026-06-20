# ResiliPlan

> **Disaster Recovery Plan Builder — Internal Edition**
> Self-hosted DRP builder untuk PT Datacomm Diangraha, dengan AI co-pilot dan ISO 22301 compliance.

## Status

**Phase:** Planning (PRD v1.1 — 2026-06-20)
**Scope:** Internal use only, free edition
**License:** Proprietary — see [LICENSE](./LICENSE)
**Primary template:** ISO 22301 (sesuai compliance existing kantor)
**AI:** BYO (Bring Your Own) API key — multi-provider support

## What is ResiliPlan?

ResiliPlan adalah tool untuk membangun, menguji, dan memelihara Disaster Recovery Plan (DRP) yang patuh terhadap **ISO 22301**. Dikembangkan untuk internal PT Datacomm Diangraha dengan kemungkinan komersialisasi di masa depan.

**Tagline:** *From static document to living plan.*

## Key Features (Planned)

- ✅ ISO 22301-aligned template (14 section dengan compliance mapping)
- ✅ AI Co-pilot per section (BYO API key — OpenAI, Anthropic, custom)
- ✅ Multi-user + role-based access (Admin, Coordinator, Owner, Viewer)
- ✅ Version control + approval workflow + e-sign
- ✅ Export PDF (siap-audit) + DOCX (editable) + Markdown (git-friendly)
- ✅ Audit trail (every change tracked)
- ⏳ DR drill scheduler (Phase 4)
- ⏳ Risk register + asset registry (Phase 4)
- ⏳ Real-time collaboration (Phase 3)

## Quick Reference

- **[PRD.md](./PRD.md)** — Master plan (17 sections, 950+ lines)
- **[docs/architecture.md](./docs/architecture.md)** — Technical architecture detail
- **[docs/ai-integration.md](./docs/ai-integration.md)** — AI provider layer design
- **[LICENSE](./LICENSE)** — Proprietary license (internal use only)

## Roadmap

| Phase | Period | Scope |
|---|---|---|
| 0 | Bulan 1 | Foundation: monorepo, Docker Compose, auth, health check |
| 1 | Bulan 2-3 | Core DRP: 14 section ISO 22301, approval, export PDF/DOCX |
| 2 | Bulan 4-5 | AI Co-pilot: BYO multi-provider, streaming, 4 section assist |
| 3 | Bulan 6-7 | Collaboration: comments, real-time edit, notifications |
| 4 | Bulan 8-10 | Enterprise: drill, risk register, asset registry (subset for internal) |

## Tech Stack

- **Frontend:** Vite + React 18 + TypeScript + Tailwind + shadcn/ui
- **Backend:** Fastify + TypeScript
- **Database:** PostgreSQL 16 (Docker)
- **AI:** Vercel AI SDK (OpenAI / Anthropic / custom URL)
- **Job Queue:** BullMQ + Redis
- **Auth:** Lucia Auth
- **PDF:** Puppeteer
- **Deployment:** Docker Compose di server kantor

## Development

_(coming soon — Phase 0 implementation)_

```bash
# Local dev (akan di-setup di Phase 0)
docker compose up
# Frontend: http://localhost:5173
# Backend: http://localhost:3001
```

## Author

**Erwin Alifiansyah** · IT Service Resilience · PT Datacomm Diangraha

---

_This project is proprietary software. See [LICENSE](./LICENSE) for terms._
