# Watch the Wolves

Automation and integration scripts for the Watch the Wolves project.

## What's in this repo

- `Framer/Code`: Framer code components used by the site.
- `Google App Scripts`: Apps Script files for schedule and waitlist workflows.
- `scripts/framer-sync.mjs`: Syncs local Framer code into a Framer project.
- `scripts/stremio-addon.mjs`: Runs a local Stremio addon server.
- `assets/`: Image and icon assets used by project tooling.

## Quick start

1. Install dependencies:
```bash
npm install
```
2. Copy environment template and fill values:
```bash
copy .env.example .env
```
3. Run common tasks:
```bash
npm run framer:list
npm run framer:sync
npm run stremio:addon
```

## Environment variables

Use `.env.example` as the source of truth. Do not commit real credentials.

## Notes for reviewers

- This repository contains automation/support tooling, not the full production frontend app.
- Sensitive credentials are intentionally excluded from version control.
