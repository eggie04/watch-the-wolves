# Framer Automation

This project includes a local Framer sync/publish script.

## 1) Install dependencies

```bash
cmd /c npm install
```

## 2) Configure environment

Copy `.env.example` to `.env` and set:

- `FRAMER_PROJECT_URL`
- `FRAMER_API_KEY`

Optional:

- `FRAMER_CODE_DIR` (defaults to `Framer/Code`)
- `FRAMER_REMOTE_PREFIX` (prefix for remote code paths)
- `FRAMER_PUBLISH=1` (publish by default)
- `FRAMER_ALLOW_OVERWRITE=1` (allow local files to overwrite differing remote files)

## 3) Verify remote paths first

```bash
node --env-file=.env scripts/framer-sync.mjs --list-only
```

## 4) Sync without publishing

```bash
node --env-file=.env scripts/framer-sync.mjs --no-publish
```

By default, overwrite protection is enabled. If a remote file differs from local,
sync will stop before applying changes so Framer-side edits are not lost.

To intentionally overwrite remote files:

```bash
node --env-file=.env scripts/framer-sync.mjs --no-publish --allow-overwrite
```

## 5) Sync and publish/deploy

```bash
node --env-file=.env scripts/framer-sync.mjs --publish
```

Or via npm scripts:

```bash
cmd /c npm run framer:list
cmd /c npm run framer:sync
cmd /c npm run framer:push
cmd /c npm run framer:sync:force
cmd /c npm run framer:push:force
```
