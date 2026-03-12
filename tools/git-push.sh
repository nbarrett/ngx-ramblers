#!/usr/bin/env bash

set -e

CURRENT_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo "")"

git push "$@"

if [[ "$CURRENT_BRANCH" != "main" ]]; then
  exit 0
fi

exec < /dev/tty
read -r -p "Deploy to all environments? [y/N] " response
exec <&-

case "$response" in
  [yY][eE][sS]|[yY])
    echo "Triggering deploy-to-environments workflow..."
    gh workflow run "Deploy to Selected Environments" \
      --ref main \
      -f environments=all \
      -f image_tag=latest
    echo "Deploy workflow triggered. Monitor progress at: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions"
    ;;
  *)
    echo "Skipping deployment."
    ;;
esac
