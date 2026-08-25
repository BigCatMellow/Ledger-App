# Notes Sync Troubleshooting

Use this page when Ledger cannot write its snapshot to your private GitHub repository.

## `404` or Repository Not Found

Check the **Repository** field on the Ledger sync page. It must use this format:

```text
OWNER/REPOSITORY
```

Example:

```text
octocat/Notes
```

Also confirm that the fine-grained token has access to that exact private repository.

A token restricted to a different repository cannot see your Notes repository even if you are signed in to GitHub in another browser tab.

---

## The `ledger-data` Branch Does Not Exist

The current Ledger sync page expects the branch you enter to already exist.

Create a branch named:

```text
ledger-data
```

from your repository's `main` branch, then try **Connect & sync now** again.

---

## Permission or `403` Errors

Edit or replace your fine-grained personal access token and confirm:

- Repository access: **Only select repositories**
- Your Notes repository is selected
- Repository permissions → **Contents: Read and write**

Ledger does not need access to all repositories.

If your token expired, create a new one and paste it into the sync page.

---

## Sync Worked Before, but the Token Is Gone

This is expected after the browser session ends.

Ledger's sync page keeps the token in browser **session storage**, so it is intentionally temporary. Reopen the sync page and paste the token again.

---

## The Snapshot Is Old

For automatic updates, leave the GitHub sync page open while you use Ledger.

The main Ledger page and the sync page use browser storage events to notice changes. If the sync tab is closed, GitHub keeps the last snapshot that successfully reached it.

You can always reopen the sync page and choose **Sync now**.

---

## I Opened Ledger on Another Device and My Projects Are Missing

The GitHub Notes repository is currently **one-way storage**, not two-way cloud sync.

Ledger does not automatically download `data/ledger.json` when it opens. Each browser has its own local Ledger data.

Until two-way synchronization is added, use one primary browser/device for your working Ledger data.

---

## I Synced from Two Different Browsers

The remote file is a full snapshot, not a mergeable database.

If two browsers contain different Ledger states, whichever browser syncs last can replace `data/ledger.json` with its own current snapshot.

Do not treat `ledger-data` as a multi-user or multi-device editing backend.

---

## Where Should the Data Be?

After a successful sync:

1. Open your private Notes repository on GitHub.
2. Switch to the `ledger-data` branch.
3. Look for:

```text
data/ledger.json
```

If the file exists there, Ledger successfully reached GitHub.

---

## Security Reset

If you think your token may have been exposed:

1. Open GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Revoke the Ledger token.
3. Generate a new token restricted to only your Notes repository.
4. Give it **Contents: Read and write** permission.
5. Paste the replacement token into Ledger's sync page.

Your Ledger browser data does not depend on the old token, so revoking it does not delete your local projects.
