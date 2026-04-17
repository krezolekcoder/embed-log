#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Activate local virtualenv if present
if [ -f ".venv/bin/activate" ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

cleanup() {
  echo ""
  echo "Stopping demo..."
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting embed-log server (YAML config)..."
python3 backend/server.py run --config embed-log.demo.yml &

sleep 1

echo "Starting UDP simulator..."
python3 utils/udp_log_simulator.py \
  --target 127.0.0.1:6000 \
  --target 127.0.0.1:6001 \
  --target 127.0.0.1:6002 \
  --interval-min 5.00 \
  --interval-max 20.00 &

echo "Starting marker injector..."
python3 utils/inject_log_demo.py \
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
