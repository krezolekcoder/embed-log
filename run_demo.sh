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

echo "Starting embed-log server..."
python3 backend/server.py \
  --source SENSOR_A udp:6000 \
  --source SENSOR_B udp:6001 \
  --source SENSOR_C udp:6002 \
  --inject SENSOR_A 5001 \
  --inject SENSOR_B 5002 \
  --inject SENSOR_C 5003 \
  --tab "Simulated Devices" SENSOR_A SENSOR_B \
  --tab "Other Sensor" SENSOR_C \
  --host 127.0.0.1 \
  --ws-port 8080 \
  --ws-ui frontend/index.html \
  --log-dir logs/ \
  &

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
