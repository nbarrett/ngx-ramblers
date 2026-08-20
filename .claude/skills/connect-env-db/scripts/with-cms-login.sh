#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${CMS_USERNAME:-}" && -n "${CMS_PASSWORD:-}" ]]; then
  export CMS_USERNAME CMS_PASSWORD
  exec "$@"
fi

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ENV_FILE="$ROOT/server/.env"
URI="${MONGODB_URI:-}"
if [[ -z "$URI" && -f "$ENV_FILE" ]]; then
  URI="$(grep '^MONGODB_URI=' "$ENV_FILE" | head -1 | sed -E 's/^MONGODB_URI=//; s/^["'\'']//; s/["'\'']$//')"
fi
if [[ -z "$URI" ]]; then
  echo "with-cms-login: set CMS_USERNAME and CMS_PASSWORD to a contentAdmin member on this environment, or set MONGODB_URI / server/.env so cms.username can be looked up" >&2
  exit 1
fi

lookup() {
  mongosh "$URI" --quiet --eval "var doc = db.config.findOne({key:\"environments\"}); var c = doc && doc.value && doc.value.cms; print((c && c.$1) || \"\");" 2>/dev/null || true
}

CMS_USERNAME="$(lookup username)"
CMS_PASSWORD="$(lookup password)"
if [[ -z "$CMS_USERNAME" || -z "$CMS_PASSWORD" ]]; then
  echo "with-cms-login: no cms.username/password on this database. Export CMS_USERNAME and CMS_PASSWORD for a contentAdmin member on this environment." >&2
  exit 1
fi

export CMS_USERNAME CMS_PASSWORD
exec "$@"
