#!/usr/bin/env bash
# Zero Factory precommit gate for hotcode-dev-zerohub-share (Astro 5 + Svelte 5 + TS, Prettier + Vitest).
# Usage:
#   ./.zerofactory/precommit.sh [format|build|test|install-hook|all]
# Prettier is pinned to 3.6.2 (see package.json): Prettier 3.7.x crashes on Svelte files
# with "getVisitorKeys is not a function" when paired with prettier-plugin-svelte 3.x.
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ensure_deps() {
  if [ ! -x node_modules/.bin/prettier ] || [ ! -x node_modules/.bin/vitest ]; then
    echo "→ Installing project dependencies (npm ci)..."
    npm ci --no-audit --no-fund
  fi
}

run_format() {
  echo "→ [format] Prettier (astro + svelte + tailwindcss plugins)..."
  ensure_deps
  npx prettier --write --ignore-unknown . --log-level warn
  npx prettier --check --ignore-unknown . --log-level warn
  echo "✓ format: all files match Prettier code style"
}

run_build() {
  echo "→ [build] TypeScript check + static build (astro check && astro build)..."
  ensure_deps
  npm run build
  echo "✓ build: astro check + astro build passed"
}

run_test() {
  echo "→ [test] Vitest suite..."
  ensure_deps
  npx vitest run
  echo "✓ test: all tests passed"
}

install_hook() {
  # Resolve the real repository checkout (a linked worktree's .git is a file,
  # and its hook target would dangle), then link pre-commit relative to it.
  local repo_root
  repo_root="$(git rev-parse --show-toplevel)"
  if [ -d "$repo_root/.git" ]; then
    ROOT_DIR="$repo_root"
  fi
  local HOOK_DIR
  HOOK_DIR="$(git rev-parse --git-path hooks 2>/dev/null || echo ".git/hooks")"
  mkdir -p "$HOOK_DIR"
  ln -sf "../../.zerofactory/precommit.sh" "$HOOK_DIR/pre-commit"
  chmod +x "$HOOK_DIR/pre-commit" 2>/dev/null || true
  echo "✓ Linked .zerofactory/precommit.sh -> $HOOK_DIR/pre-commit"
}

case "${1:-all}" in
  format)       run_format ;;
  build)        run_build ;;
  test)         run_test ;;
  install-hook) install_hook ;;
  all|*)
    run_format
    run_build
    run_test
    ;;
esac

echo "✓ Zero Factory precommit checks passed!"
