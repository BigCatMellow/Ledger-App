# Ledger — notes & roadmaps

Public GitHub Pages host for Ledger.

- `index.html` starts Ledger without any network fetches.
- Verified embedded app/runtime chunks under `assets/` reconstruct the mobile-first Ledger app in the browser.
- `sync.html` can write the latest browser snapshot to a private GitHub repository you control, using a dedicated data branch such as `ledger-data`.
- No project data, GitHub tokens, or email credentials are committed to this public repository.

Pages URL: `https://bigcatmellow.github.io/Ledger-App/`

## Documentation

- [Wiki home](docs/wiki/Home.md)
- [Set up your private Notes repository](docs/wiki/Set-Up-Your-Notes-Repository.md)
- [Notes sync troubleshooting](docs/wiki/Notes-Sync-Troubleshooting.md)

The private Notes repository is optional. Ledger's working data remains in the browser; GitHub sync currently pushes a snapshot to GitHub rather than providing two-way multi-device synchronization.
