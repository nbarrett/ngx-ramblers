#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
workflows="$root/.github/workflows"
failed=0

if rg -n --glob '*.yml' --glob '*.yaml' 'actions/(upload-artifact|download-artifact)@(v4|v5|v6)' "$workflows"; then
  echo "Use actions/upload-artifact@v7 and actions/download-artifact@v7 (runs.using: node24). v6 download still declares Node 20 and prints the deprecation warning even with FORCE_JAVASCRIPT_ACTIONS_TO_NODE24." >&2
  failed=1
fi

if rg -n --glob '*.yml' --glob '*.yaml' 'FORCE_JAVASCRIPT_ACTIONS_TO_NODE24' "$workflows"; then
  echo "Do not set FORCE_JAVASCRIPT_ACTIONS_TO_NODE24. It still prints GitHub's Node 20 deprecation warning. Use actions that declare runs.using: node24." >&2
  failed=1
fi

if rg -n --glob '*.yml' --glob '*.yaml' 'android-actions/setup-android@' "$workflows" | rg -v 'android-actions/setup-android@be39fa834029ff78f1a44aa3bb0819b8fc2bd8fd'; then
  echo "Pin android-actions/setup-android to be39fa834029ff78f1a44aa3bb0819b8fc2bd8fd (v4.0.4, runs.using: node24). Earlier pins still declare Node 20." >&2
  failed=1
fi

if test "$failed" -ne 0; then
  exit 1
fi
