#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

MIN_PY="3.11"

have_cmd() { command -v "$1" >/dev/null 2>&1; }

pick_python() {
  for c in python3 python; do
    if have_cmd "$c"; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

ver_ge() {
  # ver_ge 3.11 3.10 -> true
  [ "$(printf '%s\n' "$1" "$2" | sort -V | tail -n1)" = "$1" ]
}

PY="$(pick_python || true)"
if [ -z "$PY" ]; then
  echo "ERROR: Python not found (need >= ${MIN_PY})."
  exit 1
fi

PY_VER="$($PY - <<'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}")
PY
)"

if ! ver_ge "$PY_VER" "$MIN_PY"; then
  echo "ERROR: Python ${PY_VER} detected, need >= ${MIN_PY}."
  exit 1
fi

echo "Using $PY (version ${PY_VER})"

if ! have_cmd pipx; then
  echo "Installing pipx..."
  "$PY" -m pip install --user --upgrade pipx
fi

echo "Ensuring pipx PATH..."
"$PY" -m pipx ensurepath || true

# Keep PATH sane for current shell as well (common defaults)
export PATH="$HOME/.local/bin:$HOME/.local/pipx/bin:$PATH"

if pipx list 2>/dev/null | grep -q "package embed-log"; then
  echo "embed-log already installed in pipx -> reinstalling from current repo"
  pipx uninstall embed-log || true
fi

echo "Installing embed-log from current repository..."
pipx install .

echo "\nDone."
echo "Run from any directory:"
echo "  embed-log --help"
echo "If command is not found, open a new terminal (PATH refresh)."
