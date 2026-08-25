# Ledger Wiki

Ledger is a browser-first project notebook for notes, tasks, roadmaps, work history, and project journals.

## Getting Started

- [Set Up Your Private Notes Repository](./Set-Up-Your-Notes-Repository.md) — create your own private GitHub storage destination and connect Ledger to it.
- [Notes Sync Troubleshooting](./Notes-Sync-Troubleshooting.md) — common token, branch, and sync problems.

## How Ledger Stores Data

Ledger keeps the working copy of your projects in your browser. The optional GitHub sync page sends a snapshot of that data to a private repository you control.

This means:

- You can use Ledger without connecting GitHub at all.
- Your GitHub repository can remain private.
- The GitHub token is not committed to Ledger or to your Notes repository.
- GitHub sync is currently **one-way: Ledger → GitHub**. It is not a multi-device synchronization service and does not pull a Notes snapshot back into a different browser.

For the simplest setup, create a private repository named `Notes` and a branch named `ledger-data`, then follow the setup guide above.
