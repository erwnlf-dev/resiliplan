# Changelog

All notable changes to ResiliPlan will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial planning: PRD, architecture, AI integration docs
- Gap analysis: 40+ identified gaps vs production best practice
- LICENSE: MIT (open source)
- GitHub community files: CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue & PR templates

### Planned (Phase 0 — Foundation)
- Monorepo structure (apps/web, apps/api, packages/shared)
- Docker Compose (PostgreSQL, Redis, Fastify, Nginx)
- Lucia Auth + local user
- Health check endpoint
- Backup script (daily pg_dump)

## [0.0.0] - 2026-06-20

### Added
- Initial planning documents:
  - `PRD.md` — Master product requirements
  - `docs/architecture.md` — Technical architecture
  - `docs/ai-integration.md` — AI layer design
  - `docs/gap-analysis.md` — Production readiness gap analysis
- `README.md` — Project overview
- `LICENSE` — MIT license
- `CONTRIBUTING.md` — Contribution guide
- `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1
- `SECURITY.md` — Vulnerability disclosure policy
- `.github/ISSUE_TEMPLATE/` — Bug, feature, question templates
- `.github/PULL_REQUEST_TEMPLATE.md` — PR template

---

## Release Notes Format

Future release notes will be auto-generated via [release-please](https://github.com/googleapis/release-please) from conventional commits.

Categories:
- **Added** — new features
- **Changed** — changes in existing functionality
- **Deprecated** — soon-to-be removed features
- **Removed** — removed features
- **Fixed** — bug fixes
- **Security** — security fixes

## Versioning

- **MAJOR** version — incompatible API changes
- **MINOR** version — new functionality (backward-compatible)
- **PATCH** version — bug fixes (backward-compatible)

Pre-1.0 (0.x.x) versions are considered unstable and may have breaking changes.

[Unreleased]: https://github.com/datacomm-diangraha/resiliplan/compare/v0.0.0...HEAD
[0.0.0]: https://github.com/datacomm-diangraha/resiliplan/releases/tag/v0.0.0
