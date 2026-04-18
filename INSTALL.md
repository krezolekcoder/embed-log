# Installation

This guide covers both:
- **local testing now** (install from this repo)
- **real usage later** (install from PyPI)

---

## 1) Requirements

- Python **3.11+**
- A modern browser (Chrome/Firefox/Safari/Edge)

---

## 2) Recommended install mode for CLI users: `pipx`

If you want `embed-log` available as a global command from any directory, use `pipx`.

### 2.1 Install pipx

```bash
python3 -m pip install --user pipx
python3 -m pipx ensurepath
```

Then restart your shell (or run `source ~/.zshrc` / `source ~/.bashrc`).

If `embed-log` is still not found, add this temporarily:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

---

## 3) Local test install (from this repo)

From project root:

```bash
# optional but recommended: isolated dev env for building
python3 -m venv .venv
source .venv/bin/activate
```

If `python -m pip` fails with "No module named pip":

```bash
python3 -m ensurepip --upgrade
python3 -m pip install --upgrade pip setuptools wheel
```

Build package artifacts:

```bash
python3 -m pip install build
python3 -m build
```

Install with pipx from built wheel:

```bash
pipx install dist/embed_log-*.whl
```

Verify:

```bash
embed-log --help
```

---

## 4) Usage after install

From any directory:

```bash
embed-log init
embed-log validate --config embed-log.yml
embed-log run --config embed-log.yml
```

Demo from repo root:

```bash
./run_demo.sh
# optional: avoid auto-opening browser
./run_demo.sh --no-browser
```

---

## 5) Reinstall after local code changes

When you changed code and want to retest packaging:

```bash
python3 -m build
pipx reinstall dist/embed_log-*.whl
```

Uninstall:

```bash
pipx uninstall embed-log
```

---

## 6) Once published on PyPI

Users will install with:

```bash
pipx install embed-log
```

Upgrade:

```bash
pipx upgrade embed-log
```

---

## 7) Alternative: install inside a project venv (not global)

Use this when `embed-log` is part of a project environment/CI:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install embed-log
```

Then run `embed-log ...` while that venv is activated.

---

## 8) Unit tests

Run tests from the project virtualenv (recommended):

```bash
.venv/bin/python3 -m unittest discover -s tests -v
```

(or after activating `.venv`: `python3 -m unittest discover -s tests -v`)

---

## 9) Legacy direct run from source (developer mode)

Still supported from project root:

```bash
python3 backend/server.py run --config examples/embed-log.yml
```

But for end users, prefer packaged CLI (`embed-log ...`).
