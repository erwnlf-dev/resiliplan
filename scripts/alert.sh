#!/bin/bash
#
# ResiliPlan Telegram alert sender
#
# Usage:
#   alert.sh "Message text"
#
# Reads Telegram bot credentials from /etc/resiliplan/secrets/telegram
# Format (key=value per line):
#   TELEGRAM_BOT_TOKEN=123456:ABC-DEF
#   TELEGRAM_CHAT_ID=-1001234567890
#

set -euo pipefail

MESSAGE="${1:-}"
if [ -z "$MESSAGE" ]; then
  echo "Usage: $0 <message>" >&2
  exit 1
fi

# Load credentials
SECRETS_FILE="/etc/resiliplan/secrets/telegram"
if [ ! -f "$SECRETS_FILE" ]; then
  echo "WARN: Telegram secrets file not found: $SECRETS_FILE (alerts disabled)" >&2
  exit 0  # Don't fail the calling script
fi

# Source credentials (handle comments and empty lines)
TELEGRAM_BOT_TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' "$SECRETS_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
TELEGRAM_CHAT_ID=$(grep '^TELEGRAM_CHAT_ID=' "$SECRETS_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")

if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
  echo "WARN: Telegram credentials incomplete in $SECRETS_FILE (alerts disabled)" >&2
  exit 0
fi

# Send via Telegram Bot API
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')
FULL_MESSAGE="🔔 *ResiliPlan Alert*
${TIMESTAMP}

${MESSAGE}"

# URL-encode the message (basic)
ENCODED_MESSAGE=$(echo -n "$FULL_MESSAGE" | jq -sRr @uri)

API_URL="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"

HTTP_CODE=$(curl -s -o /tmp/telegram-response.txt -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg chat_id "$TELEGRAM_CHAT_ID" \
    --arg text "$FULL_MESSAGE" \
    --arg parse_mode "Markdown" \
    '{chat_id: $chat_id, text: $text, parse_mode: $parse_mode, disable_web_page_preview: true}')" \
  "$API_URL" || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  echo "Alert sent to Telegram (chat_id=${TELEGRAM_CHAT_ID})"
else
  echo "ERROR: Telegram API returned HTTP $HTTP_CODE" >&2
  cat /tmp/telegram-response.txt >&2
fi

# Cleanup
rm -f /tmp/telegram-response.txt
