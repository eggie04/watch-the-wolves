# Watch the Wolves

Repository for automation, integration tooling, and supporting code used across the Watch the Wolves ecosystem.

## Project overview

This project combines three main systems:

- Framer code sync and deployment automation.
- Google Apps Script APIs for schedules and waitlist workflows.
- A local Stremio addon server for channel/stream distribution tests.

The repository is focused on operational tooling and integration code rather than a standalone production web app.

## Architecture at a glance

- Framer workflow:
  Local `Framer/Code` files are synchronized to a Framer project using `framer-api`, with overwrite protection and optional publish/deploy.
- Apps Script workflow:
  `Google App Scripts` provides web app endpoints for schedule/feed output and waitlist logic.
- Stremio workflow:
  `scripts/stremio-addon.mjs` serves a manifest/catalog/meta/stream addon using env-configured channel data.

## Repository structure

- `Framer/Code/`
  Framer components and route-level code used in the Framer project.
- `Framer/FRAMER_AUTOMATION.md`
  Framer sync/publish usage details.
- `Google App Scripts/`
  Apps Script source files (`.gs` and transpiled `.js`) for schedule, feed, and waitlist behavior.
- `Google App Scripts/TVMPLAYER_FEED.md`
  TVMplayer-specific feed endpoint notes.
- `scripts/framer-sync.mjs`
  Sync utility for pushing local Framer code into remote Framer project files.
- `scripts/stremio-addon.mjs`
  Local Stremio addon server with single-channel and multi-channel modes.
- `scripts/windows/`
  Windows launcher/start/stop scripts for local operational workflows.
- `Stremio/STREMIO_ADDON.md`
  Stremio setup and testing guide.
- `assets/`
  Static images/icons referenced by addon and tooling.

## Tech stack

- Node.js (ESM)
- `framer-api`
- `stremio-addon-sdk`
- Google Apps Script

## Local setup

1. Install dependencies:
```bash
npm install
```

2. Create local env file from template:
```bash
copy .env.example .env
```

3. Fill required values in `.env`:
- `FRAMER_PROJECT_URL`
- `FRAMER_API_KEY`
- Stremio variables as needed (`STREMIO_STREAM_URL` or `STREMIO_CHANNELS_JSON`, etc.)

## NPM scripts

- `npm run framer:list`
  Lists remote Framer code files.
- `npm run framer:sync`
  Syncs local files without publishing.
- `npm run framer:push`
  Syncs and publishes/deploys.
- `npm run framer:sync:force`
  Syncs with overwrite enabled for remote-different files.
- `npm run framer:push:force`
  Force-syncs and publishes.
- `npm run stremio:addon`
  Starts local Stremio addon server (default `http://127.0.0.1:7010/manifest.json`).

## Key operational behaviors

- Framer sync has overwrite protection by default to avoid accidental loss of remote edits.
- Stremio addon supports:
  - Single-channel mode via `STREMIO_STREAM_URL`.
  - Multi-channel mode via `STREMIO_CHANNELS_JSON`.
- Relative asset URLs in addon config can be resolved through `STREMIO_PUBLIC_BASE_URL`.

## Security and repo hygiene

- Real credentials are not stored in tracked files.
- Use `.env.example` as the template and keep `.env` local only.
- If tokens are ever exposed, rotate immediately and rewrite Git history before public exposure.

## Notes for reviewers

- This repo showcases integration engineering and automation workflows:
  API wiring, deployment automation, feed generation, and runtime tooling.
- It intentionally does not include all private production services or credentials.
