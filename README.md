# Cockpit-Paru

A [Cockpit](https://cockpit-project.org/) web UI plugin for Arch Linux package management with AUR support via [paru](https://github.com/Morganamilo/paru).

## Features

- **Updates** — View and apply repo and AUR updates, with streaming progress
- **Installed Packages** — Browse, filter, and inspect all installed packages
- **Search** — Search repo, AUR, or both simultaneously
- **History** — View pacman transaction log history
- **Cache Management** — Inspect and clean the package cache
- **Keyring** — Manage pacman-key trusted keys
- **Mirrors** — View and manage pacman mirror configuration
- **Scheduled Upgrades** — Systemd timer for automatic background updates

## Requirements

- [Cockpit](https://cockpit-project.org/) v300+
- [paru](https://github.com/Morganamilo/paru) (must be at `/usr/bin/paru`)
- Arch Linux (or Arch-based distribution)

## Installation

### From source

```bash
# Install build dependencies
sudo pacman -S npm rust cargo

# Clone and build
git clone https://github.com/gideonwolfe/cockpit-paru.git
cd cockpit-paru
makepkg -si
```

### Development

```bash
# Install dependencies and build
make build

# Symlink into local Cockpit for development
make devel-install

# Watch for frontend changes
npm run watch
```

Then open Cockpit at `https://localhost:9090` — the "Paru" tab appears in the navigation.

## Architecture

The frontend is **React/TypeScript** with **PatternFly 6**, bundled with esbuild. The backend is a **Rust CLI binary** that communicates via Cockpit's `cockpit.spawn()` API — each operation is a separate process invocation, not a persistent server.

Long-running operations (upgrades, AUR installs) stream newline-delimited JSON progress events back to the frontend.

```
Frontend → cockpit.spawn([backend, command, ...args]) → Backend CLI → JSON stdout
```

## Building

```bash
make build          # Full build (backend + frontend)
make test           # Run all tests
make lint           # Clippy + ESLint
make check          # Typecheck + lint + test
```

## License

GPL-3.0-or-later
