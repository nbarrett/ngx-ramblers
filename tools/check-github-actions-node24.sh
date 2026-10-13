#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
banned='actions/(upload-artifact|download-artifact)@v4'
if rg -n --glob '*.yml' --glob '*.yaml' "$banned" "$root/.github/workflows"; then
  echo "Use actions/upload-artifact@v6 and actions/download-artifact@v6 (Node 24). v4 still runs on Node 20 and prints the deprecation warning even with FORCE_JAVASCRIPT_ACTIONS_TO_NODE24." >&2
  exit 1
fi
