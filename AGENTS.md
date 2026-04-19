# AGENTS.md

Quick onboarding notes for future coding agents and humans working in `embed-log`.

## Project intent

`embed-log` is a configurable log aggregation server for embedded development and CI. It ingests multiple sources (UART/UDP), merges and timestamps events, stores per-session artifacts, streams live data to a backend-configured tabs/panes UI, and supports test-driven marker/TX injection over TCP.

## Architecture at a glance

1. **Source readers** (`uart`, `udp`) feed lines into per-source queues.
2. **SourceManager writer thread** serializes output order and writes to:
   - stdout (only in verbose mode)
   - per-session raw log files in `logs/<session_id>/`
   - WebSocket payloads (if UI enabled)
   - inject-port stream clients (JSON)
   - optional forward-port clients (raw RX lines)
3. **WebSocketBroadcaster** serves UI and pushes `rx`/`tx` events.
4. **Session artifacts** are generated in each session directory (optionally suffixed with CI `job_id`):
   - `manifest.json`
   - `session.html` (auto-export on last WS disconnect and on SIGINT/SIGTERM)
5. **Frontend** renders tabs/panes, filters, settings, export/import, selection, splitters, refresh cache, and sessions popup.

## Run locally (recommended)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

embed-log init
embed-log validate --config embed-log.yml
embed-log run --config embed-log.yml
# or: ./run_demo.sh
```

UI: usually `http://127.0.0.1:8080/` (demo script may auto-fallback to another free 808x port).
Tip: `server.open_browser: true` (or `--open-browser`) opens the UI automatically on startup.
Tip: `server.app_name` (or `--app-name`) customizes the top-left UI bar name.

## Key code locations

- Backend core runtime: `backend/core/runtime.py`
- Backend CLI/entry compatibility: `backend/cli.py`, `backend/server.py`
- Slug/naming helper: `backend/core/naming.py`
- Unit tests: `tests/` (run with `python3 -m unittest discover -s tests -v`)
- Client APIs: `backend/log_client.py`, `backend/tx_client.py`
- Frontend entry: `frontend/main.js`
- Frontend state/layout: `frontend/state.js`, `frontend/tabs.js`, `frontend/tabcreate.js`, `frontend/ui.js`
- Live transport: `frontend/ws.js`
- Rendering: `frontend/lines.js`
- Frontend cache persistence: `frontend/persist.js`

## Current UX features (important context)

- Reliable macOS-friendly splitter dragging.
- Pane swap UI via hover popup on tab labels.
- Visual swap pulse animation.
- Local refresh cache of logs/layout (with toolbar "Clear cache" action).
- Session-aware cache keys (cache scoped by backend session id).
- Toolbar sessions UX:
  - `Current HTML` button (open current session export)
  - `Sessions` popup (browse/open saved sessions and manifests)

## Change guidelines

- Keep frontend as plain modules (no build tool assumptions).
- Prefer minimal, targeted edits over rewrites.
- Preserve protocol compatibility:
  - WS sends `config` first, then log events.
  - `config` now includes `session` metadata.
  - Inject sockets accept newline-delimited JSON.
- Keep session APIs stable unless intentionally versioned:
  - `GET /api/session/current`
  - `GET /api/sessions`
  - `GET /sessions/<session_id>/<filename>`
- Any new backend capability should be easy to drive from both:
  - direct Python clients (`log_client`, `tx_client`)
  - browser WebSocket path.

## Suggested next backend priorities

1. Bounded queues + drop/backpressure counters.
2. `/health` + `/stats` endpoint(s) for CI observability.
3. Optional server-side retention/replay window.
4. Optional auth for non-local deployments.

## Documentation map

- `README.md` — main docs
- `DIRECTORY_GUIDE.md` — directory explanations
- `FRONTEND.md` — frontend details
- `INSTALL.md` — setup
- `MERGE.md` — offline merge utility
