# Ledger — notes & roadmaps

This repository contains the **public static web app only**. Project data and email-report infrastructure live in the private `BigCatMellow/Notes` repository.

## Architecture

- `index.html` — lightweight GitHub Pages loader.
- `assets/app-index.html.gz` — compressed mobile-first Ledger application.
- `assets/support.js.gz` — compressed UI runtime.
- `sync.html` — authenticated sync page that writes the latest Ledger snapshot to private `BigCatMellow/Notes` → `ledger-data` → `data/ledger.json`.
- `.nojekyll` — keeps GitHub Pages serving the static files directly.

Project data, GitHub tokens, and email credentials are **not committed to this public repository**.

Ledger keeps its live working state in browser `localStorage` under `ledger-notes-roadmaps-v2`. Both the old `/Notes/` Pages path and the new `/Ledger-App/` path use the same `https://bigcatmellow.github.io` origin, so existing browser-local Ledger state remains available on the new site.

## GitHub Pages

Enable Pages from:

`Settings → Pages → Deploy from a branch → main → / (root)`

Expected site:

`https://bigcatmellow.github.io/Ledger-App/`

Private sync page:

`https://bigcatmellow.github.io/Ledger-App/sync.html`

## Private sync

Use a fine-grained GitHub token restricted to `BigCatMellow/Notes` with only:

- Repository permissions → **Contents: Read and write**

Paste it into `sync.html`. The token is kept in browser `sessionStorage` and is never committed.
