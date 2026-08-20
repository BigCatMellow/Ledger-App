# Ledger — notes & roadmaps

This repository contains the public, static Ledger web app.

## Architecture

- `index.html` — Ledger UI and browser-local working state.
- `support.js` — UI runtime used by Ledger.
- `sync.html` — optional authenticated sync page that writes the latest Ledger snapshot to the private `BigCatMellow/Notes` repository.
- Project data is **not** committed to this public repository.
- Email credentials are **not** stored here; the private Notes repository owns the scheduled report workflow and GitHub Actions secrets.

Ledger stores its live working state in browser `localStorage` under `ledger-notes-roadmaps-v2`. Because GitHub Pages for repositories under the same account uses the same `https://bigcatmellow.github.io` origin, moving from `/Notes/` to `/Ledger-App/` does not change the localStorage origin.

## GitHub Pages

Enable Pages from this repository's `main` branch and `/ (root)` folder. The expected site URL is:

`https://bigcatmellow.github.io/Ledger-App/`

## Private sync

Open `sync.html` from the Pages site and use a fine-grained GitHub token restricted to `BigCatMellow/Notes` with only:

- Repository permissions → Contents: Read and write

The token is kept in browser `sessionStorage` and is never committed.
