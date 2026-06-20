# ResiliPlan

> **Disaster Recovery Plan Builder — ISO 22301-aligned, AI-assisted, self-hosted**
> Free & open source · Self-host untuk kantor Anda sendiri

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Status: Planning](https://img.shields.io/badge/status-planning-yellow.svg)](./PRD.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Security Policy](https://img.shields.io/badge/security-policy-brightgreen.svg)](./SECURITY.md)
[![Code of Conduct](https://img.shields.io/badge/code%20of-conduct-ff69b4.svg)](./CODE_OF_CONDUCT.md)

**ResiliPlan** adalah tool self-hosted untuk membangun, menguji, dan memelihara Disaster Recovery Plan (DRP) yang patuh terhadap **ISO 22301**. Dilengkapi dengan AI co-pilot (BYO API key) untuk mempercepat drafting procedure, BIA, dan compliance documentation.

> **Tagline:** *From static document to living plan.*

## ✨ Key Features

- ✅ **ISO 22301-aligned template** (14 section dengan auto-mapping ke ISO 22301 clauses + NIST 800-34 + BCI GPG reference)
- ✅ **AI Co-pilot per section** (BYO API key — OpenAI, Anthropic, custom URL, local LLM)
- ✅ **Multi-user + role-based access** (Admin, Coordinator, Owner, Viewer)
- ✅ **Version control + approval workflow + e-sign**
- ✅ **Export PDF** (siap-audit) + **DOCX** (editable) + **Markdown** (git-friendly)
- ✅ **Audit trail** (every change tracked, append-only, exportable)
- ⏳ **DR drill scheduler** (planned Phase 4)
- ⏳ **Risk register + asset registry** (planned Phase 4)
- ⏳ **Real-time collaboration** (planned Phase 3)

## 🎯 Use Case

**Ideal untuk:**
- IT Service Manager / DR Coordinator yang manage BCP/DRP internal
- Compliance team yang perlu ISO 22301-compliant DRP documentation
- Tim IT yang ingin automate DRP drafting (AI-assisted)
- Organisasi yang butuh self-hosted tool (data privacy, compliance)
- Auditor yang perlu versioned, traceable, evidence-based DRP

**Bukan untuk:**
- Organisasi yang butuh managed SaaS (we don't provide hosting)
- Real-time incident management (ini planning tool, bukan incident response tool)

## 🚀 Quick Start

_(Coming soon — Phase 0 implementation)_

```bash
# Clone
git clone https://github.com/datacomm-diangraha/resiliplan.git
cd resiliplan

# Start
docker compose up -d

# Open
open http://localhost:5173
```

Lihat [`docs/architecture.md`](./docs/architecture.md) untuk tech detail.

## 📖 Documentation

| Document | Deskripsi |
|---|---|
| [PRD.md](./PRD.md) | Master product requirements (956 lines) |
| [docs/architecture.md](./docs/architecture.md) | Technical architecture detail (528 lines) |
| [docs/ai-integration.md](./docs/ai-integration.md) | AI provider layer + prompt templates (591 lines) |
| [docs/gap-analysis.md](./docs/gap-analysis.md) | Production readiness gap analysis (29KB) |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute |
| [SECURITY.md](./SECURITY.md) | Vulnerability disclosure policy |
| [CHANGELOG.md](./CHANGELOG.md) | Release history |

## 🛣️ Roadmap

| Phase | Status | Scope |
|---|---|---|
| **0 — Foundation** | ⏳ Planning | Monorepo, Docker Compose, auth, health check, backup |
| **1 — Core DRP** | ⏳ Planning | ISO 22301 template, 14 section editor, approval, export |
| **2 — AI Co-pilot** | ⏳ Planning | BYO multi-provider AI, streaming, 4 section assist |
| **3 — Collaboration** | ⏳ Future | Comments, real-time edit, notifications |
| **4 — Enterprise** | ⏳ Future | Drill scheduler, risk register, asset registry |

Lihat [PRD section 10](./PRD.md#10-implementation-roadmap) untuk detail.

## 🛠️ Tech Stack

**Frontend:** Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui
**Backend:** Fastify + TypeScript
**Database:** PostgreSQL 16
**AI:** Vercel AI SDK (OpenAI / Anthropic / custom URL)
**Job Queue:** BullMQ + Redis 7
**Auth:** Lucia Auth
**Deployment:** Docker Compose (self-hosted)

Lihat [docs/architecture.md](./docs/architecture.md) untuk full package list.

## 🔒 Security & Privacy

- **Self-hosted** = data tidak pernah keluar server Anda (kecuali ke AI provider yang Anda configure)
- **BYO AI key** = Anda kontrol penuh model, cost, dan data policy AI
- **API key encryption** = AES-256-GCM at rest
- **Audit log** = immutable, append-only, exportable
- **RBAC** = 4-role permission system

Lihat [SECURITY.md](./SECURITY.md) untuk vulnerability disclosure + best practices.

## 🤝 Contributing

Contributions welcome! 🎉

- 🐛 [Report a bug](https://github.com/datacomm-diangraha/resiliplan/issues/new?template=bug_report.md)
- 💡 [Request a feature](https://github.com/datacomm-diangraha/resiliplan/issues/new?template=feature_request.md)
- ❓ [Ask a question](https://github.com/datacomm-diangraha/resiliplan/issues/new?template=question.md)
- 🔧 [Submit a PR](./CONTRIBUTING.md)
- 🌍 [Translate](./CONTRIBUTING.md#-translate)

Baca [CONTRIBUTING.md](./CONTRIBUTING.md) untuk development setup.

## 📄 License

[MIT](./LICENSE) — free untuk use, modify, distribute, commercial use.

Copyright (c) 2026 PT Datacomm Diangraha

## 👤 Author & Maintainer

**Erwin Alifiansyah** · IT Service Resilience · PT Datacomm Diangraha

Dibuat sebagai internal tool, dishare sebagai open source untuk benefit komunitas IT resilience Indonesia & global.

## 🙏 Acknowledgments

- **Standards:** ISO 22301, NIST SP 800-34, BCI GPG
- **AI:** Vercel AI SDK, OpenAI, Anthropic
- **Open source libraries:** lihat [package.json](./apps/web/package.json) dan [apps/api/package.json](./apps/api/package.json)
- **Inspiration:** Linear, Notion, Vercel (UI/UX), Nextcloud, GitLab (open source governance)

---

⭐ **Star this repo** if ResiliPlan helps your DR/BCP work!

📢 **Share with your team** if your organization needs ISO 22301-aligned DRP tooling.
