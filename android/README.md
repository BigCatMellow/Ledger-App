# Ledger Android shell

This is a minimal Android WebView wrapper for the Stationery Ledger UI:

`https://bigcatmellow.github.io/Ledger-App/stationery/`

## What lives in the APK

- WebView shell and Ledger launcher icon
- same-origin navigation for Ledger and its sync tools
- Android file picker support for Markdown import
- Android document-save support for Markdown export
- native status/navigation bar colors that follow Ledger light/dark mode
- external links open in the user's normal browser

The Ledger UI itself remains hosted on GitHub Pages, so ordinary web UI changes do **not** require rebuilding the APK.

## Important storage behavior

Android WebView has its own browser storage; it does not automatically share Chrome's localStorage. The Android shell therefore redirects Ledger's GitHub Sync link to `stationery/android-sync.html`, which provides explicit:

- **Load from GitHub** — restore the latest private `ledger-data/data/ledger.json` snapshot onto the phone.
- **Push this phone** — send the phone's current Ledger snapshot back to the private Notes repository.

On a new phone/app install, load from GitHub before creating or pushing phone data.

## GitHub Actions build

`.github/workflows/build-ledger-android.yml` builds a debug APK with no local Android Studio installation required.

Download the `Ledger-Android-debug` artifact from the workflow run and install `Ledger.apk` on Android.

## Signing

The first automated build is a debug-signed personal APK. Because GitHub-hosted runners create ephemeral debug signing keys, a later debug build may require uninstalling the old debug APK before installing the new one.

This is acceptable for the initial wrapper because normal Ledger UI updates arrive from GitHub Pages without rebuilding the APK. Before native Android features need regular APK updates, configure a persistent release keystore through GitHub Actions Secrets and build a release APK with that stable key.
