#!/usr/bin/env bash

set -e

DEPLOY_ALL_AFTER_BUILD=0
PUSH_ARGS=()

for arg in "$@"; do
  if [[ "$arg" == "--deploy-all-after-build" ]]; then
    DEPLOY_ALL_AFTER_BUILD=1
  else
    PUSH_ARGS+=("$arg")
  fi
done

CURRENT_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo "")"
HEAD_SHA="$(git rev-parse HEAD)"

PUSH_CONFIRMED=1 git push "${PUSH_ARGS[@]}"

if [[ "$CURRENT_BRANCH" != "main" ]]; then
  exit 0
fi

should_deploy_all_after_build() {
  if [[ "$DEPLOY_ALL_AFTER_BUILD" == "1" ]]; then
    return 0
  fi

  if [[ ! -t 0 && ! -t 1 ]]; then
    return 1
  fi

  exec < /dev/tty
  read -r -p "Deploy to all environments after the main build succeeds? [y/N] " response
  exec <&-

  case "$response" in
    [yY][eE][sS]|[yY])
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

find_build_run_id() {
  gh run list \
    --workflow build-push-and-deploy-ngx-ramblers-docker-image.yml \
    --branch main \
    --limit 20 \
    --json databaseId,headSha,event \
    --jq ".[] | select(.headSha == \"$HEAD_SHA\" and .event == \"push\") | .databaseId" \
    | head -n 1
}

wait_for_build_run_id() {
  local run_id=""
  local attempt=0
  while [[ -z "$run_id" && "$attempt" -lt 30 ]]; do
    run_id="$(find_build_run_id)"
    if [[ -n "$run_id" ]]; then
      echo "$run_id"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 10
  done
  return 1
}

trigger_all_environments_deploy() {
  local run_id="$1"
  local conclusion
  local run_number
  local run_url

  gh run watch "$run_id" --interval 10

  conclusion="$(gh run view "$run_id" --json conclusion --jq '.conclusion')"
  run_number="$(gh run view "$run_id" --json number --jq '.number')"
  run_url="$(gh run view "$run_id" --json url --jq '.url')"

  if [[ "$conclusion" != "success" ]]; then
    echo "Build workflow did not succeed. Skipping all-environments deploy."
    echo "Build run: $run_url"
    exit 1
  fi

  echo "Triggering deploy-to-environments workflow for all environments using image tag $run_number..."
  gh workflow run "Deploy to Selected Environments" \
    --ref main \
    -f environments=all \
    -f image_tag="$run_number"
  echo "Deploy workflow triggered from successful build run: $run_url"
}

if should_deploy_all_after_build; then
  echo "Waiting for the build workflow for commit $HEAD_SHA..."
  BUILD_RUN_ID="$(wait_for_build_run_id)" || {
    echo "Could not find the build workflow run for commit $HEAD_SHA."
    exit 1
  }
  trigger_all_environments_deploy "$BUILD_RUN_ID"
else
  echo "Skipping all-environments deployment."
fi
