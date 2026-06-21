#!/usr/bin/env bash
#
# Backup Restore Verification Script
# Tests that daily PostgreSQL custom-format backups can be restored into an isolated test DB.
#
# Usage: ./scripts/backup-restore-test.sh [BACKUP_FILE]
#
# Env:
#   BACKUP_DIR                 default: <repo>/backups/daily
#   DATABASE_URL               main DB connection string, loaded from .env when present
#   RESTORE_ADMIN_DATABASE_URL  admin connection used to create/drop test DB; default derives postgres DB from DATABASE_URL
#   RESTORE_TEST_DB_NAME        optional fixed test DB name; default resiliplan_restore_test_<timestamp>
#

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups/daily}"
TEST_DB_NAME="${RESTORE_TEST_DB_NAME:-resiliplan_restore_test_$(date +%s)}"
export TEST_DB_NAME

log_info() { echo "[INFO] $1"; }
log_warn() { echo "[WARN] $1"; }
log_error() { echo "[ERROR] $1"; }

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
  echo "[ERROR] DATABASE_URL is not set. Put it in .env or export it before running restore verification." >&2
  exit 1
fi
export DATABASE_URL

for cmd in node find sort head cut psql pg_restore; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "required command not found: $cmd"
    log_error "Install PostgreSQL client tools before running backup restore verification."
    exit 127
  fi
done

ADMIN_URL="${RESTORE_ADMIN_DATABASE_URL:-}"
if [[ -z "$ADMIN_URL" ]]; then
  ADMIN_URL="$(node -e "const u=new URL(process.env.DATABASE_URL); u.pathname='/postgres'; console.log(u.toString())")"
fi
TEST_URL="$(node -e "const u=new URL(process.env.DATABASE_URL); u.pathname='/' + process.env.TEST_DB_NAME; console.log(u.toString())" )"

if [[ $# -eq 0 ]]; then
  log_info "Finding most recent backup in $BACKUP_DIR..."
  BACKUP_FILE="$(find "$BACKUP_DIR" -name "resiliplan_*.dump" -type f -printf "%T@ %p\n" 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)"
  if [[ -z "$BACKUP_FILE" ]]; then
    log_error "No backup files found in $BACKUP_DIR"
    exit 1
  fi
else
  BACKUP_FILE="$1"
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  log_error "Backup file not found: $BACKUP_FILE"
  exit 1
fi
log_info "Using backup file: $BACKUP_FILE"

cleanup() {
  log_info "Cleaning up test database: $TEST_DB_NAME"
  psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$TEST_DB_NAME\" WITH (FORCE);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
log_info "Creating test database: $TEST_DB_NAME"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$TEST_DB_NAME\";" >/dev/null

log_info "Restoring backup to isolated test database..."
pg_restore --dbname "$TEST_URL" "$BACKUP_FILE" --no-owner --no-privileges --clean --if-exists >/tmp/resiliplan_restore_test_pg_restore.log 2>&1 || {
  log_error "pg_restore failed. Last restore log lines:"
  tail -40 /tmp/resiliplan_restore_test_pg_restore.log >&2 || true
  exit 1
}

TABLES=("users" "tenants" "drp_plans" "drp_sections" "bia_entries" "service_assets" "service_risks" "recovery_drills" "email_outbox" "plan_evidence")
MISSING_TABLES=()
log_info "Checking essential tables..."
for table in "${TABLES[@]}"; do
  if ! psql "$TEST_URL" -v ON_ERROR_STOP=1 -c "SELECT 1 FROM $table LIMIT 1;" >/dev/null 2>&1; then
    MISSING_TABLES+=("$table")
  fi
done
if [[ ${#MISSING_TABLES[@]} -gt 0 ]]; then
  log_error "Missing tables: ${MISSING_TABLES[*]}"
  exit 1
fi
log_info "✓ Essential tables present (${#TABLES[@]})"

COUNT_MISMATCHES=()
log_info "Comparing restored row counts with source database..."
for table in "${TABLES[@]}"; do
  MAIN_COUNT="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -c "SELECT COUNT(*) FROM $table;" | tr -d '[:space:]')"
  TEST_COUNT="$(psql "$TEST_URL" -v ON_ERROR_STOP=1 -t -c "SELECT COUNT(*) FROM $table;" | tr -d '[:space:]')"
  if [[ "$MAIN_COUNT" != "$TEST_COUNT" ]]; then
    log_warn "Row count mismatch for $table: main=$MAIN_COUNT, test=$TEST_COUNT"
    COUNT_MISMATCHES+=("$table")
  fi
done

MIGRATION_COUNT="$(psql "$TEST_URL" -v ON_ERROR_STOP=1 -t -c "SELECT COUNT(*) FROM _resiliplan_migrations;" | tr -d '[:space:]')"
log_info "✓ Migration history present ($MIGRATION_COUNT migrations)"

CRITICAL_INDEXES=("sessions_user_id_idx" "drp_plans_tenant_id_idx" "drp_sections_plan_id_idx" "audit_logs_tenant_id_idx" "email_outbox_tenant_status_idx" "plan_evidence_plan_id_idx")
MISSING_INDEXES=()
log_info "Checking critical indexes..."
for idx in "${CRITICAL_INDEXES[@]}"; do
  EXISTS="$(psql "$TEST_URL" -v ON_ERROR_STOP=1 -t -c "SELECT COUNT(*) FROM pg_indexes WHERE indexname = '$idx';" | tr -d '[:space:]')"
  if [[ "$EXISTS" == "0" ]]; then
    MISSING_INDEXES+=("$idx")
  fi
done
if [[ ${#MISSING_INDEXES[@]} -gt 0 ]]; then
  log_error "Missing critical indexes: ${MISSING_INDEXES[*]}"
  exit 1
fi
log_info "✓ Critical indexes present (${#CRITICAL_INDEXES[@]})"

FK_COUNT="$(psql "$TEST_URL" -v ON_ERROR_STOP=1 -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY';" | tr -d '[:space:]')"
if [[ "$FK_COUNT" -eq 0 ]]; then
  log_error "No foreign key constraints found"
  exit 1
fi
log_info "✓ Foreign key constraints present ($FK_COUNT constraints)"

log_info "========================================="
log_info "Backup Restore Verification: PASSED"
log_info "Backup file: $BACKUP_FILE"
log_info "Test database: $TEST_DB_NAME"
log_info "Essential tables: ${#TABLES[@]} verified"
log_info "Migrations: $MIGRATION_COUNT applied"
log_info "Indexes: ${#CRITICAL_INDEXES[@]} verified"
log_info "Foreign keys: $FK_COUNT constraints verified"
if [[ ${#COUNT_MISMATCHES[@]} -gt 0 ]]; then
  log_warn "Note: ${#COUNT_MISMATCHES[@]} tables had row count differences; investigate if source DB changed during backup."
fi
log_info "========================================="
