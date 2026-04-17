#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Prefer project venv interpreter when available (pick one that actually works)
for CAND in .venv/bin/python3.14 .venv/bin/python3 .venv/bin/python python3 python; do
  if [ -x "$CAND" ] || command -v "$CAND" >/dev/null 2>&1; then
    if "$CAND" - <<'PY' >/dev/null 2>&1
import sys
print(sys.version)
PY
    then
      PYTHON="$CAND"
      break
    fi
  fi
done

if [ -z "${PYTHON:-}" ]; then
  echo "ERROR: no working python interpreter found"
  exit 1
fi

# Ensure runtime deps for YAML demo mode exist (for the SAME interpreter)
if ! "$PYTHON" - <<'PY' >/dev/null 2>&1
import yaml, aiohttp, serial
PY
then
  echo "Installing/updating Python dependencies for $PYTHON ..."

  # Prefer pip bound to this interpreter.
  if ! "$PYTHON" -m pip --version >/dev/null 2>&1; then
    "$PYTHON" -m ensurepip --upgrade >/dev/null 2>&1 || true
  fi

  if "$PYTHON" -m pip --version >/dev/null 2>&1; then
    "$PYTHON" -m pip install -r requirements.txt
  elif [ -x .venv/bin/pip3.14 ]; then
    .venv/bin/pip3.14 install -r requirements.txt
  elif [ -x .venv/bin/pip3 ]; then
    .venv/bin/pip3 install -r requirements.txt
  else
    echo "ERROR: pip is unavailable for $PYTHON"
    echo "Run manually with a matching interpreter, e.g.: .venv/bin/python3.14 -m pip install -r requirements.txt"
    exit 1
  fi
fi

cleanup() {
  echo ""
  echo "Stopping demo..."
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting embed-log server (YAML config)..."
"$PYTHON" backend/server.py run --config embed-log.demo.yml &
SERVER_PID=$!

sleep 1
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "ERROR: embed-log server failed to start."
  echo "Tip: activate venv and install deps: pip install -r requirements.txt"
  exit 1
fi

echo "Starting UDP simulator..."
"$PYTHON" utils/udp_log_simulator.py \
  --target 127.0.0.1:6000 \
  --target 127.0.0.1:6001 \
  --target 127.0.0.1:6002 \
  --interval-min 5.00 \
  --interval-max 20.00 &

echo "Starting marker injector..."
"$PYTHON" utils/inject_log_demo.py \
  --inject SENSOR_A 5001 \
  --inject SENSOR_B 5002 \
  --inject SENSOR_C 5003 \
  --interval 5 \
  --duration 0 \
  --source demo &

echo ""
echo "Demo running!"
echo "Open: http://127.0.0.1:8080/"
echo "Press Ctrl+C to stop all processes."

wait
