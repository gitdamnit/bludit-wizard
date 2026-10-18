# GitHub Release — Bludit Wizard v1.1.0

This document describes the published v1.1.0 release. It authorizes nothing by
itself; publication is performed by the maintainer or an authorized release
operator.

## Release identity

- **Repository:** https://github.com/gitdamnit/bludit-wizard
- **Tag:** `v1.1.0`
- **Title:** Bludit Wizard v1.1.0
- **Artifact:** `bludit-wizard-1.1.0.zip`
- **License:** GPL-3.0-only
- **Compatibility:** Bludit 3.22.x (Community and Pro), PHP 8.0+
- **Checksum:** see `bludit-wizard-1.1.0.zip.sha256` and the release body

## Build

```bash
scripts/build-release.sh 1.1.0
scripts/verify-release-zip.sh dist/bludit-wizard-1.1.0.zip
sha256sum dist/bludit-wizard-1.1.0.zip
```

The archive contains a single top-level `wizard/` directory, all runtime assets,
`lib/netpolicy.php` and the generated `assets.json` manifest. It contains no
credentials, Git metadata, test output or development dependencies.

## Publish

1. Commit the stable release changes and confirm a clean working tree.
2. Push the default branch.
3. Create and push the annotated tag `v1.1.0`.
4. Create the GitHub Release from `docs/RELEASE_NOTES_1.1.0.md`.
5. Attach `bludit-wizard-1.1.0.zip` and include its SHA-256.
6. Download the published asset again and verify its checksum and contents.
7. Submit the release metadata to the official Bludit plugins repository using
   the download URL of the verified asset.

## Verification

- `scripts/verify-release-zip.sh` installs the ZIP on fresh Community and Pro
  containers, checks the admin workspace, served JavaScript hash, native-form
  recovery and AJAX dispatch, and runs a browser smoke against the installed
  ZIP.
- The full harness remains: HTTP/API/security/task suite, Playwright on Community
  and Pro, and the network-policy unit suite.

Do not describe the Bludit directory submission as accepted until the listing is
visible in the official directory.
