# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Cockpit-paru is a Cockpit web UI plugin for Arch Linux package management with AUR support. The frontend is React/TypeScript with PatternFly 6, the backend is a Rust CLI binary that communicates via Cockpit's cockpit.spawn() API.

## Build & Test Commands

```bash
# Full build (backend + frontend)
make build

# Backend only
cargo build --release        # binary: backend/target/release/cockpit-paru-backend

# Frontend only
npm install && npm run build # output: dist/

# Run all tests
make test                    # both frontend (52 tests) and backend (87 tests)

# Frontend tests
npm test                     # vitest (all)
npx vitest run src/utils.test.ts           # single file
npx vitest run --testNamePattern="format"  # by test name

# Backend tests
cargo test                   # all unit tests
cargo test test_validate     # filter by name

# Linting
make lint                    # clippy + eslint
npm run typecheck            # tsc --noEmit

# Full CI check
make check                   # typecheck + lint + test

# Development install (symlinks to ~/.local/)
make devel-install

# Watch mode
npm run watch
```

## Architecture

### Communication Model
Frontend → cockpit.spawn([BACKEND_PATH, command, ...args]) → Backend CLI → JSON stdout

The backend is NOT a server. Each operation is a separate process invocation. Long-running operations (upgrade, sync, AUR install) stream JSON events line-by-line.

### Backend (backend/src/)
- main.rs — CLI entry point. Match on command name (50+ commands), calls handler, prints JSON.
- handlers/ — One file per domain: query.rs (list/search), mutation.rs (upgrade/sync), aur.rs, cache.rs, mirrors.rs, keyring.rs, dependency.rs, downgrade.rs, log.rs, news.rs, reboot.rs, scheduled.rs, config.rs
- aur/mod.rs — AUR RPC API client (ureq v3). Queries https://aur.archlinux.org/rpc/v5/.
- alpm/ — ALPM handle setup, callbacks, transaction guard (RAII pattern)
- models.rs — All serde response structs
- validation.rs — Input validation for all user-supplied values
- util.rs — Signal handling (ctrlc), TimeoutGuard, emit_event for streaming JSON

### Frontend (src/)
- api.ts — All backend communication. runBackend<T>() for request/response, runStreamingBackend() for streaming ops. All TypeScript interfaces matching backend models.
- components/App.tsx — 7-tab layout: Updates, Installed, Search, History, Cache, Keyring, Mirrors
- components/UpdatesView.tsx — Largest (~1400 lines). Repo updates + AUR updates card.
- components/SearchView.tsx — Repo/AUR/Both toggle search.
- hooks/ — useSortableTable, usePagination, useDebounce, useAutoScrollLog, usePackageDetails, useAurPackageDetails, useForceGraph

### Streaming Protocol
Backend emits newline-delimited JSON for long ops:
```json
{"type":"progress","operation":"upgrading","package":"linux","percent":50,"current":1,"total":5}
{"type":"complete","success":true}
```
Frontend parses in runStreamingBackend() via proc.stream() callback.

### Install Paths
- Backend binary: /usr/libexec/cockpit-paru/cockpit-paru-backend
- Frontend assets: /usr/share/cockpit/paru/
- Config: /etc/cockpit-paru/config.json
- Systemd units: cockpit-paru-scheduled.timer/.service
- Logs: /var/log/cockpit-paru/

## Conventions

- PatternFly 6 with pf-v6-u-* utility classes. Modals use ModalHeader/ModalBody/ModalFooter children (not title/actions props).
- useAutoScrollLog() returns a ref directly, not a destructured object.
- AUR operations shell out to paru (paru -S --noconfirm, paru -Sua --noconfirm, paru -Gp).
- ureq v3: use .into_body().read_to_string() + serde_json::from_str() (not .read_json()).
- alpm::Version::new() takes &str — use .as_str() when passing String.
- All user inputs validated in validation.rs. Frontend also sanitizes via utils.ts.
- Test mocks in src/test/mocks.ts with createMockSpawnPromise() and createMockStreamingProcess().
- cockpit global mocked in src/test/setup.ts — exposes mockSpawn for test assertions.
