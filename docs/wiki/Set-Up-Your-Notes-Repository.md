# Set Up Your Private Notes Repository

Ledger can optionally send a copy of its browser data to a private GitHub repository that you control. The repository is commonly named `Notes`, but it can have any name.

> **Important:** this is currently a one-way snapshot from Ledger to GitHub. It is useful for backup, reporting, and automation. It does not pull your projects into another browser or merge changes between devices.

## What You Need

- A GitHub account
- A private GitHub repository
- A dedicated branch for Ledger data
- A fine-grained GitHub personal access token with access only to that repository

No paid GitHub plan is required for the basic setup.

---

## 1. Create Your Private Repository

1. Sign in to GitHub.
2. Choose **New repository**.
3. Name it `Notes` if you want to follow the recommended convention.
4. Set the repository to **Private**.
5. Turn on **Add a README file** so the repository has an initial `main` branch.
6. Create the repository.

Your repository address will look like:

```text
YOUR-USERNAME/Notes
```

If you use another repository name, that is fine. You will enter the actual `owner/repository` value in Ledger later.

---

## 2. Create the `ledger-data` Branch

Ledger stores its snapshots on a separate branch so normal repository history does not fill up with frequent data-sync commits.

1. Open your new Notes repository.
2. Open the branch selector that currently says `main`.
3. Choose **View all branches**.
4. Choose **New branch**.
5. Name it:

```text
ledger-data
```

6. Create it from `main`.

You can technically use a different branch name because Ledger lets you enter one on the sync page, but `ledger-data` is recommended and is the expected branch name for the standard reporting workflow.

---

## 3. Create a Fine-Grained GitHub Token

The token gives Ledger permission to update only your private Notes repository.

In GitHub:

1. Open **Settings**.
2. Go to **Developer settings**.
3. Open **Personal access tokens → Fine-grained tokens**.
4. Choose **Generate new token**.
5. Give it a recognizable name such as `Ledger Sync`.
6. Choose a reasonable expiration date.
7. Under **Repository access**, choose **Only select repositories**.
8. Select your private Notes repository.
9. Under **Repository permissions**, set:

```text
Contents: Read and write
```

Ledger does not need broad account access or access to your other repositories.

10. Generate the token.
11. Copy it when GitHub displays it. GitHub will not show the full token again later.

### Keep the token private

Treat the token like a password. Do not put it in a README, issue, screenshot, source file, or public repository.

If you accidentally expose it, revoke it in GitHub and create a new one.

---

## 4. Connect Ledger to Your Repository

Open Ledger, then choose:

**Tools → GitHub sync**

On the sync page, enter:

### Repository

```text
YOUR-USERNAME/Notes
```

Use your actual GitHub username and repository name.

### Data branch

```text
ledger-data
```

### Fine-grained GitHub token

Paste the token you created above.

Then choose:

**Connect & sync now**

A successful connection will report that the project snapshot was synced to GitHub.

---

## 5. Verify the Snapshot

In GitHub:

1. Open your Notes repository.
2. Switch from `main` to the `ledger-data` branch.
3. Open:

```text
data/ledger.json
```

That JSON file is the latest Ledger snapshot sent from that browser.

It may contain project titles, notes, roadmap information, journal entries, tasks, and work-history data, so the repository should remain private.

---

## 6. How Automatic Sync Works

The GitHub sync page is intentionally separate from the main Ledger page.

After you connect it:

- The token is kept in browser **session storage**, not in the repository.
- Leave the GitHub sync tab open while using Ledger if you want changes to be pushed automatically during that browser session.
- Ledger changes trigger a short delayed sync rather than creating a GitHub request for every keystroke.
- The sync page also periodically checks for changes while it remains open.
- Closing the browser session removes the stored token, so you may need to paste it again later.

## What GitHub Sync Does Not Do Yet

GitHub is currently a destination for snapshots; it is not the authoritative working database for Ledger.

That means:

- Opening Ledger on a second device does **not** download `ledger.json` automatically.
- Two browsers do not merge their data.
- Syncing from another browser can replace the remote snapshot with that browser's current Ledger state.

For now, use one primary Ledger browser/device if the GitHub snapshot matters to you.

---

## Optional: Email Reports and Automation

The private Notes repository can also be used by GitHub Actions to build Ledger reports from `ledger-data/data/ledger.json`.

A reporting workflow typically:

1. Runs from the repository's normal `main` branch.
2. Fetches the `ledger-data` branch.
3. Reads `data/ledger.json`.
4. Builds a report.
5. Sends it using SMTP credentials stored in **GitHub Actions Secrets**.

Typical secrets are:

```text
REPORT_EMAIL_TO
SMTP_USERNAME
SMTP_PASSWORD
SMTP_FROM
```

For providers other than the workflow's default SMTP service, it can also use repository variables such as:

```text
SMTP_HOST
SMTP_PORT
```

Email credentials should never be committed to either branch.

---

## Privacy Checklist

Before considering setup complete, confirm:

- [ ] Notes repository is **Private**
- [ ] `ledger-data` branch exists
- [ ] Fine-grained token is restricted to only the Notes repository
- [ ] Token permission is only what Ledger needs: **Contents: Read and write**
- [ ] Token is not saved in source control
- [ ] `data/ledger.json` is visible only inside the private repository

If sync does not work, see [Notes Sync Troubleshooting](./Notes-Sync-Troubleshooting.md).
