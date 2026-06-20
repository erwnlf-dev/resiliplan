# Contributing to ResiliPlan

Terima kasih sudah tertarik untuk contribute ke ResiliPlan! 🎉

ResiliPlan adalah Disaster Recovery Plan builder dengan ISO 22301 compliance, AI co-pilot, dan self-hosted architecture. Kami welcome kontribusi dari siapa saja yang ingin improve project ini.

## Code of Conduct

Project ini mengikuti [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). Dengan participate, Anda expected untuk uphold code ini. Report unacceptable behavior ke maintainers.

## How Can I Contribute?

### 🐛 Report Bugs
- Use [Bug Report template](./.github/ISSUE_TEMPLATE/bug_report.md)
- Include: reproduction steps, expected vs actual, environment (OS, Docker version, etc.)
- Check existing issues dulu untuk avoid duplicate

### 💡 Suggest Features
- Use [Feature Request template](./.github/ISSUE_TEMPLATE/feature_request.md)
- Explain use case, not just solution
- Consider apakah ini in-scope dengan project vision (ISO 22301, DR/BCP, AI-assisted)

### 📖 Improve Documentation
- Documentation always welcome — typo fix, clarify wording, add example
- PR langsung ke file yang relevan (README.md, docs/*.md, inline code comments)

### 🔧 Submit Code
- Bug fix, refactor, new feature
- Follow [Development Setup](#development-setup) di bawah
- Submit via Pull Request (lihat [PR process](#pull-request-process))

### 🌍 Translate
- Kami primarily bahasa Indonesia
- English translation welcome untuk international reach
- Use conventional commits untuk track translation progress

## Development Setup

### Prerequisites
- Node.js 20+ & npm
- Docker & Docker Compose
- Git
- (Optional) PostgreSQL client (`psql`)

### Quick Start

```bash
# Clone repo
git clone https://github.com/datacomm-diangraha/resiliplan.git
cd resiliplan

# Install dependencies (monorepo)
npm install

# Start dev environment (PostgreSQL + Redis + API + Web)
docker compose -f docker-compose.dev.yml up -d

# Run database migrations
npm run db:migrate

# Seed development data (optional)
npm run db:seed

# Start API dev server
npm run dev:api

# Start web dev server (in another terminal)
npm run dev:web

# Open http://localhost:5173
```

### Project Structure

```
resiliplan/
├── apps/
│   ├── web/              # Vite + React + TypeScript frontend
│   ├── api/              # Fastify + TypeScript backend
│   └── worker/           # (future) BullMQ worker
├── packages/
│   └── shared/           # Shared types & constants
├── docs/                 # Documentation (PRD, architecture, etc)
├── .github/              # GitHub-specific files (workflows, templates)
└── docker-compose.yml    # Production deployment
```

### Code Style

- **TypeScript strict mode** — no `any` unless absolutely necessary
- **ESLint + Prettier** — auto-format on save (configured)
- **Conventional commits** — `feat:`, `fix:`, `docs:`, `chore:`, etc.
- **Test required** untuk new features — aim for ≥ 70% coverage
- **Update docs** jika behavior berubah

### Commit Messages

Kami pakai [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add ISO 22301 clause mapping to section
fix: validate date format in cleanDate helper
docs: update README with Docker quick start
chore: bump drizzle-orm to 0.33
refactor: extract AI provider factory to separate module
test: add unit tests for plan service
```

Format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Testing

```bash
# Run all tests
npm test

# Run specific workspace
npm test --workspace=apps/api

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Code Review Process

1. Open PR dengan template yang ada
2. Wait for CI to pass (lint + test + build)
3. Address review feedback
4. Setelah approve, maintainer akan merge (squash merge)

## Pull Request Process

1. **Fork** repo & create branch dari `main`
   - Branch naming: `feat/iso-22301-mapping`, `fix/date-validation`, `docs/runbook`
2. **Make changes** dengan commit conventional
3. **Update tests** — semua new code harus tested
4. **Update docs** jika behavior berubah (README, docs/*.md, inline comments)
5. **Verify locally:**
   ```bash
   npm run lint
   npm test
   npm run build
   docker compose up  # smoke test
   ```
6. **Push** ke your fork
7. **Open PR** dengan template yang menjelaskan:
   - What changed & why
   - Link to related issue (jika ada)
   - Screenshots / video (untuk UI change)
   - Test plan
8. **Wait for review** — maintainer akan review dalam 1-3 hari
9. **Address feedback** jika ada
10. **Merge** — setelah approve, maintainer akan squash merge

### PR Checklist

- [ ] Tests pass (`npm test`)
- [ ] Lint pass (`npm run lint`)
- [ ] Build pass (`npm run build`)
- [ ] Documentation updated
- [ ] Conventional commit format
- [ ] Linked to issue (jika applicable)
- [ ] Self-reviewed code

## Release Process

Maintainer yang handle release:

1. Update version di `package.json` (semantic versioning)
2. Update `CHANGELOG.md` (auto-generated via release-please)
3. Create git tag `vX.Y.Z`
4. GitHub Actions akan build & push Docker image ke ghcr.io
5. GitHub Release dengan release notes

## Security Issues

**Jangan** report security vulnerability via public GitHub issue. Lihat [SECURITY.md](./SECURITY.md) untuk responsible disclosure process.

## Community

- 💬 GitHub Discussions — untuk Q&A, ideas, show & tell
- 🐛 GitHub Issues — untuk bug & feature requests
- 📧 Email — untuk private/security matters

## Recognition

Contributors akan di-acknowledge di:
- README (Contributors section)
- Release notes
- CHANGELOG.md

## Questions?

Feel free untuk open a [Discussion](https://github.com/datacomm-diangraha/resiliplan/discussions) atau contact maintainers.

---

Terima kasih untuk kontribusi Anda! 🙏
