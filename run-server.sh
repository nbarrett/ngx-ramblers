#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

APP_NAME="${NGX_APP:-ngx-ramblers-ekwg}"
SECRETS_FILE="$ROOT_DIR/non-vcs/secrets/secrets.${APP_NAME}.env"

if [ ! -f "$SECRETS_FILE" ]; then
  echo "Secrets file not found: $SECRETS_FILE"
  echo "Set NGX_APP to the app name (e.g. ngx-ramblers-ekwg)"
  exit 1
fi

while IFS= read -r _line || [ -n "$_line" ]; do
  [[ "$_line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${_line// }" ]] && continue
  _key="${_line%%=*}"
  _value="${_line#*=}"
  _value="${_value#\"}"
  _value="${_value%\"}"
  _value="${_value#\'}"
  _value="${_value%\'}"
  [[ -n "$_key" ]] && export "${_key}=${_value}"
done < "$SECRETS_FILE"

export NODE_ENV=development
export PORT="${PORT:-5001}"
export DEBUG="${DEBUG:-ngx-ramblers:*}"
export DEBUG_COLORS=true
export NODE_OPTIONS="--max_old_space_size=2560"
export PLATFORM_ADMIN_ENABLED=true

exec npm run server-live --prefix "$ROOT_DIR/server"
