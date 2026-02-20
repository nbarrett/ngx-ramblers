#!/usr/bin/env bash
cd "$(dirname "$0")"
[ -f node_modules/.bin/claude-swarm ] || npm install
exec node_modules/.bin/claude-swarm
