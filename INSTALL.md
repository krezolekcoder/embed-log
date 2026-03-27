# Installation

## Requirements

- Python 3.11+ (3.12 recommended)
- [uv](https://docs.astral.sh/uv/) — Python package and project manager
- A modern browser (Chrome, Firefox, Safari, Edge) for the frontend

---

## Python setup

### 1. Install uv

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Or via pip:

```bash
pip install uv
```

### 2. Create the virtual environment and install dependencies

From the project root:

```bash
uv sync
```

This reads `pyproject.toml`, pins the Python version from `.python-version` (3.12), creates a `.venv/`, and installs `pyserial` and `aiohttp`.

### 3. Run the server

```bash
uv run backend/server.py --source /dev/ttyUSB0 "Device A"
```

Or use the installed script entry point (after `uv sync`):

```bash
uv run embed-log --source /dev/ttyUSB0 "Device A"
```

Full usage:

```bash
uv run backend/server.py --help
```

---

## Frontend

No build step or package manager required. The frontend is plain HTML + native ES modules served directly by the Python server.

Open `http://localhost:8765` in your browser after starting the server.

---

## Offline log viewer (merge_logs.py)

Merge one or more `.log` files into a self-contained HTML file:

```bash
# Two panes in one tab
uv run utils/merge_logs.py \
    --tab "UART" "Device A" logs/device-a.log \
                 "Device B" logs/device-b.log \
    --output merged.html

# Two tabs
uv run utils/merge_logs.py \
    --tab "UART"   "Device A" logs/device-a.log \
                   "Device B" logs/device-b.log \
    --tab "PYTEST" "Pytest"     logs/pytest.log \
    --output run-42.html
```

Open the resulting `.html` file in any browser — no server needed.

---

## Development dependencies

The project has no runtime JS dependencies. Python dev tools can be added to an optional group if needed:

```bash
uv add --dev ruff mypy   # example
```

---

## CI example (GitHub Actions)

```yaml
- name: Set up Python with uv
  uses: astral-sh/setup-uv@v4
  with:
    python-version-file: .python-version

- name: Install dependencies
  run: uv sync

- name: Start embed-log
  run: |
    uv run backend/server.py \
      --source /dev/ttyUSB0 "DUT" \
      --inject 5001 \
      &
    echo $! > /tmp/embed-log.pid

- name: Stop embed-log
  if: always()
  run: kill $(cat /tmp/embed-log.pid) || true
```
