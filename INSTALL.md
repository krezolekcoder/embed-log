# Installation

## Requirements

- Python 3.11+
- A modern browser (Chrome, Firefox, Safari, Edge)

Runtime Python dependencies:
- `pyserial`
- `aiohttp`
- `PyYAML`

---

## Quick setup (no uv)

From project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## Start the server

### Recommended (YAML config)

```bash
python3 backend/server.py run --config examples/embed-log.yml
```

Demo config in repo root:

```bash
python3 backend/server.py run --config embed-log.demo.yml
```

### Legacy CLI mode (still supported)

```bash
python3 backend/server.py \
  --source SENSOR_A udp:6000 \
  --source SENSOR_B udp:6001 \
  --inject SENSOR_A 5001 \
  --inject SENSOR_B 5002 \
  --tab "Devices" SENSOR_A SENSOR_B \
  --ws-port 8080
```

Logs are saved in per-session subdirectories under `logs.dir` (from YAML), including `manifest.json` and `session.html`.

UI (when `ws_port` is enabled):

```text
http://127.0.0.1:8080/
```

---

## One-command local demo

```bash
./run_demo.sh
```

---

## Offline merged viewer

```bash
python3 utils/merge_logs.py \
  --tab "UART" "Device A" logs/DEVICE_A.log \
               "Device B" logs/DEVICE_B.log \
  --output merged.html
```

Open generated HTML directly in browser (no server needed).
