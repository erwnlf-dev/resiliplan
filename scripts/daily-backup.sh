#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups/daily}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ENV_FILE="$ROOT/.env"

if [[ -z "${DATABASE_URL:-}" && -f "$ENV_FILE" ]]; then
  DATABASE_URL="$(node - "$ENV_FILE" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const text = fs.readFileSync(file, 'utf8');
for (const raw of text.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const idx = line.indexOf('=');
  if (idx === -1) continue;
  const key = line.slice(0, idx).trim();
  if (key !== 'DATABASE_URL') continue;
  let value = line.slice(idx + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  console.log(value);
  break;
}
NODE
)"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set. Put it in .env or export it before running backup." >&2
  exit 1
fi
export DATABASE_URL

for cmd in pg_dump sha256sum; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $cmd" >&2
    echo "Install PostgreSQL client tools before running backup verification." >&2
    exit 127
  fi
done

mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/resiliplan_${TIMESTAMP}.dump"

pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file "$OUT"
sha256sum "$OUT" > "$OUT.sha256"
find "$BACKUP_DIR" -type f -name 'resiliplan_*.dump*' -mtime +"$RETENTION_DAYS" -delete

echo "Backup created: $OUT"
echo "Checksum: $OUT.sha256"
