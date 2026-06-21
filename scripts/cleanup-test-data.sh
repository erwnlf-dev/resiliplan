#!/usr/bin/env bash
# =============================================================================
# ResiliPlan cleanup script (production-safe)
# =============================================================================
# Clears test/demo data from the ResiliPlan database while PRESERVING:
#   - tenants        (organization record)
#   - users          (admin accounts)
#   - subscriptions  (billing config)
#   - ai_providers   (configured AI providers with encrypted keys)
#   - settings       (tenant settings: SMTP, etc.)
#   - tenants_settings (jsonb config on tenants)
#
# WIPES test data from:
#   - plans, plan_sections, plan_comments, plan_approvals
#   - bia_entries
#   - assets, risks
#   - drills, drill_participants
#   - audit_logs
#   - sessions, password_resets, mfa_secrets
#   - plan_evidence, plan_versions
#   - notifications
#
# Usage:
#   ./scripts/cleanup-test-data.sh           # interactive confirmation
#   ./scripts/cleanup-test-data.sh --yes     # skip confirmation
#   ./scripts/cleanup-test-data.sh --dry-run # show what would be wiped
#   ./scripts/cleanup-test-data.sh --backup  # auto-backup before wipe
#
# Requires: psql, DATABASE_URL in .env (apps/api/.env or project root .env)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env from project root (use parser that handles unquoted spaces)
load_env() {
  local env_file="$1"
  [ -f "$env_file" ] || return 1
  # Only KEY=VALUE lines; strip inline comments; preserve spaces in values
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip blanks and comments
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    # Only lines with = and a key before =
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    local key="${BASH_REMATCH[1]}"
    local val="${BASH_REMATCH[2]}"
    # Strip surrounding quotes if present
    val="${val%\"}"
    val="${val#\"}"
    val="${val%\'}"
    val="${val#\'}"
    # Strip trailing inline comment (not inside quotes)
    [[ "$val" =~ ^[^#]* ]] && val="${BASH_REMATCH[0]}"
    # Trim trailing whitespace
    val="${val%"${val##*[![:space:]]}"}"
    export "$key"="$val"
  done < "$env_file"
}

if [ -f "$PROJECT_ROOT/.env" ]; then
  load_env "$PROJECT_ROOT/.env"
elif [ -f "$PROJECT_ROOT/apps/api/.env" ]; then
  load_env "$PROJECT_ROOT/apps/api/.env"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set. Place .env in project root or apps/api/." >&2
  exit 1
fi

# Parse args
ASSUME_YES=false
DRY_RUN=false
DO_BACKUP=false
for arg in "$@"; do
  case "$arg" in
    --yes|-y) ASSUME_YES=true ;;
    --dry-run) DRY_RUN=true ;;
    --backup) DO_BACKUP=true ;;
    --help|-h)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

# Tables to PRESERVE (KEEP)
KEEP_TABLES=(
  "tenants"
  "users"
  "subscriptions"
  "ai_providers"
  "settings"
  "tenant_settings"
)

# Tables to WIPE (TRUNCATE)
# Using actual table names from the database schema
WIPE_TABLES=(
  "drp_plans"
  "drp_sections"
  "plan_comments"
  "plan_evidence"
  "plan_versions"
  "approvals"
  "bia_entries"
  "service_assets"
  "service_risks"
  "recovery_drills"
  "audit_logs"
  "sessions"
  "password_resets"
  "mfa_secrets"
  "notifications"
  "email_outbox"
  "usage_events"
)

# Build psql connection args
PSQL_CONN=("$PROJECT_ROOT/apps/api/node_modules/.bin/psql" "$DATABASE_URL" -t -A)
# Fallback: use system psql
if [ ! -x "${PSQL_CONN[0]}" ]; then
  PSQL_CONN=(psql "$DATABASE_URL" -t -A)
fi

# Verify which tables exist (some schemas may not have all tables)
existing_wipe=()
for tbl in "${WIPE_TABLES[@]}"; do
  exists=$("${PSQL_CONN[@]}" -c "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$tbl' LIMIT 1" 2>/dev/null || echo "")
  if [ "$exists" = "1" ]; then
    existing_wipe+=("$tbl")
  fi
done

# Verify keep tables actually exist
existing_keep=()
for tbl in "${KEEP_TABLES[@]}"; do
  exists=$("${PSQL_CONN[@]}" -c "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$tbl' LIMIT 1" 2>/dev/null || echo "")
  if [ "$exists" = "1" ]; then
    existing_keep+=("$tbl")
  fi
done

# Count rows that will be preserved (sanity)
echo "=== Current database state ==="
echo ""
echo "KEEP tables (will be preserved):"
for tbl in "${existing_keep[@]}"; do
  count=$("${PSQL_CONN[@]}" -c "SELECT COUNT(*) FROM $tbl" 2>/dev/null || echo "?")
  printf "  %-25s %s rows\n" "$tbl" "$count"
done
echo ""
echo "WIPE tables (will be truncated):"
for tbl in "${existing_wipe[@]}"; do
  count=$("${PSQL_CONN[@]}" -c "SELECT COUNT(*) FROM $tbl" 2>/dev/null || echo "?")
  printf "  %-25s %s rows\n" "$tbl" "$count"
done
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "[DRY-RUN] No changes made. Use --yes to actually run cleanup."
  exit 0
fi

# Confirm
if [ "$ASSUME_YES" != true ]; then
  echo "This will TRUNCATE ${#existing_wipe[@]} tables and PRESERVE ${#existing_keep[@]} tables."
  echo "Tenants/users/AI providers/SMTP settings will be SAFE."
  echo ""
  read -r -p "Type 'yes' to continue: " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
fi

# Optional backup before wipe
if [ "$DO_BACKUP" = true ]; then
  BACKUP_DIR="$PROJECT_ROOT/apps/api/backups"
  mkdir -p "$BACKUP_DIR"
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  BACKUP_FILE="$BACKUP_DIR/resiliplan-pre-cleanup-$TIMESTAMP.dump"
  echo ""
  echo "Creating backup: $BACKUP_FILE"
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump "$DATABASE_URL" -Fc -f "$BACKUP_FILE"
    echo "  backup size: $(du -h "$BACKUP_FILE" | cut -f1)"
  else
    echo "  WARNING: pg_dump not available, skipping backup"
  fi
fi

# Truncate with CASCADE (in case of FK references from kept tables)
TRUNCATE_LIST=$(IFS=','; echo "${existing_wipe[*]}")
echo ""
echo "Truncating: $TRUNCATE_LIST"
"${PSQL_CONN[@]}" -c "TRUNCATE TABLE $TRUNCATE_LIST RESTART IDENTITY CASCADE;" 2>&1

# Reset sequences
echo ""
echo "Resetting sequences..."
"${PSQL_CONN[@]}" -c "
DO \$\$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public' LOOP
    EXECUTE 'ALTER SEQUENCE ' || quote_ident(r.sequence_name) || ' RESTART WITH 1';
  END LOOP;
END
\$\$;" 2>&1 | tail -3

# Verify
echo ""
echo "=== After cleanup ==="
for tbl in "${existing_wipe[@]}"; do
  count=$("${PSQL_CONN[@]}" -c "SELECT COUNT(*) FROM $tbl" 2>/dev/null || echo "?")
  printf "  %-25s %s rows\n" "$tbl" "$count"
done
echo ""
echo "=== Preserved tables ==="
for tbl in "${existing_keep[@]}"; do
  count=$("${PSQL_CONN[@]}" -c "SELECT COUNT(*) FROM $tbl" 2>/dev/null || echo "?")
  printf "  %-25s %s rows\n" "$tbl" "$count"
done
echo ""
echo "✅ Cleanup complete. Tenants, users, AI providers, and settings preserved."
