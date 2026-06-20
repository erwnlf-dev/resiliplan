#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== ResiliPlan internal production check =="
echo "[1/4] Typecheck"
pnpm typecheck

echo "[2/4] Build"
pnpm build

echo "[3/4] API tests"
pnpm --filter @resiliplan/api test

echo "[4/4] DB migrations"
pnpm --filter @resiliplan/api run db:migrate

echo "OK: internal production verification completed."
