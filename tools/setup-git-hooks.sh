#!/bin/bash

# Setup git hooks from .githooks directory
# This installs commit message validation to prevent AI attribution

HOOKS_DIR=".githooks"
GIT_HOOKS_DIR=".git/hooks"

if [ ! -d "$GIT_HOOKS_DIR" ]; then
  # Silently skip if not in a git repository (e.g., Docker build, CI/CD)
  exit 0
fi

if [ ! -d "$HOOKS_DIR" ]; then
  echo "❌ .githooks directory not found"
  exit 1
fi

echo "📦 Setting up git hooks..."

# Copy all hooks from .githooks to .git/hooks
for hook in "$HOOKS_DIR"/*; do
  if [ -f "$hook" ]; then
    hook_name=$(basename "$hook")
    cp "$hook" "$GIT_HOOKS_DIR/$hook_name"
    chmod +x "$GIT_HOOKS_DIR/$hook_name"
    echo "✅ Installed hook: $hook_name"
  fi
done

echo ""
echo "✅ Git hooks setup complete!"
echo ""
echo "The following checks are now active:"
echo "  - commit-msg: Prevents AI attribution in commit messages"
echo ""
