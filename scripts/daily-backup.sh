#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups/daily}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ENV_FILE="$ROOT/.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set. Put it in .env or export it before running backup." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/resiliplan_${TIMESTAMP}.dump"

pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file "$OUT"
sha256sum "$OUT" > "$OUT.sha256"
find "$BACKUP_DIR" -type f -name 'resiliplan_*.dump*' -mtime +"$RETENTION_DAYS" -delete

echo "Backup created: $OUT"
echo "Checksum: $OUT.sha256"
