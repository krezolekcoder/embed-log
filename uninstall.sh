#!/usr/bin/env bash
set -euo pipefail

if ! command -v pipx >/dev/null 2>&1; then
  echo "pipx is not installed; nothing to uninstall via pipx."
  exit 0
fi

if pipx list 2>/dev/null | grep -q "package embed-log"; then
  pipx uninstall embed-log
  echo "embed-log uninstalled."
else
  echo "embed-log is not installed via pipx."
fi
