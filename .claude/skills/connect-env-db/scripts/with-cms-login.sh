#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${CMS_USERNAME:-}" && -n "${CMS_PASSWORD:-}" ]]; then
  export CMS_USERNAME CMS_PASSWORD
  exec "$@"
fi

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ENV_FILE="$ROOT/server/.env"
if [[ -z "${MONGODB_URI:-}" && ! -f "$ENV_FILE" ]]; then
  echo "with-cms-login: set CMS_USERNAME and CMS_PASSWORD to a contentAdmin member on this environment, or set MONGODB_URI / server/.env so cms.username can be looked up" >&2
  exit 1
fi

lookup() {
  (cd "$ROOT" && ./bin/ngx-cli environments-value "cms.$1" | tail -1) || true
}

CMS_USERNAME="$(lookup username)"
CMS_PASSWORD="$(lookup password)"
if [[ -z "$CMS_USERNAME" || -z "$CMS_PASSWORD" ]]; then
  echo "with-cms-login: no cms.username/password on this database. Export CMS_USERNAME and CMS_PASSWORD for a contentAdmin member on this environment." >&2
  exit 1
fi

export CMS_USERNAME CMS_PASSWORD
exec "$@"
