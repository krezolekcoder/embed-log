# embed-log

`embed-log` is a lightweight log aggregation server for embedded development and CI. It collects logs from UART/UDP sources, stores them in per-session artifacts, and streams them live to a browser UI.

## Features

- log sources: **UART** and **UDP**
- live browser UI over WebSocket
- YAML-configured UI layout: tabs and panes per source
- per-session logs and artifacts in `logs/<session_id>/`
- automatic session export to `session.html`
- session manifest: `manifest.json`
- optional TCP ports for inject/TX and raw RX forwarding
- CLI for config initialization, validation, and running the app

## Installation

```bash
git clone <repo-url>
cd embed-log
./install.sh
```

After installation, the command should be available globally:

```bash
embed-log --help
```

If your shell cannot find it, open a new terminal window or refresh your `PATH`.

## Update / reinstall

To update an existing installation, get the latest repository version and run the installer again:

```bash
cd embed-log
git pull
./install.sh
```

If you do not have the repository locally anymore, clone it again and run the installer:

```bash
git clone <repo-url>
cd embed-log
./install.sh
```

After updating, force-refresh the browser UI to avoid using cached frontend files:

- macOS: `Cmd + Shift + R`
- Windows/Linux: `Ctrl + Shift + R` or `Ctrl + F5`

This is especially important in Firefox, where old JavaScript/CSS files may remain cached after an update.

## Configuration

Copy the example config and adjust the ports/sources:

```bash
cp examples/embed-log.yml my-embed-log.yml
```

Example `my-embed-log.yml`:

```yaml
version: 1

server:
  host: 127.0.0.1
  ws_port: 8080
  app_name: embed-log
  open_browser: false
  verbosity: quiet

logs:
  dir: logs/

baudrate: 115200

sources:
  - name: DUT_UART
    type: uart
    port: /dev/ttyUSB0
    inject_port: 5001

  - name: SENSOR_A
    type: udp
    port: 6000
    inject_port: 5002

tabs:
  - label: Devices
    panes: [DUT_UART, SENSOR_A]
```

> For UART, set the correct port for your system, e.g. `/dev/ttyUSB0`, `/dev/tty.usbserial-*`, or `COM3`.

## Running

Optionally validate the config first:

```bash
embed-log validate --config my-embed-log.yml
```

Start the app:

```bash
embed-log --config my-embed-log.yml
```

The UI will be available at the address configured in YAML. By default:

```text
http://127.0.0.1:8080/
```

## Useful commands

```bash
# generate a starter config
embed-log init --output embed-log.yml

# start and open the browser automatically
embed-log --config my-embed-log.yml --open-browser

# show more runtime logs in the terminal
embed-log --config my-embed-log.yml --verbosity events
```

## Output files

Each run creates a session directory:

```text
logs/<session_id>/
```

Important files:

- `manifest.json` — session metadata
- `session.html` — browser-openable session export
- `.log` files — source logs
