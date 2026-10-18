# Bludit Plugin Directory Submission — v1.1.0

**Status:** submitted as
[bludit/plugins-repository#489](https://github.com/bludit/plugins-repository/pull/489).
The pull request is **open**; the plugin is **not yet accepted or listed** in the
official directory.

## Published release

- **Repository:** https://github.com/gitdamnit/bludit-wizard
- **Tag / release:** https://github.com/gitdamnit/bludit-wizard/releases/tag/v1.1.0
- **Download:** https://github.com/gitdamnit/bludit-wizard/releases/download/v1.1.0/bludit-wizard-1.1.0.zip
- **SHA-256:** `51bfcb43c41412f30d9e68c7e99c54bc0a29213527ec9c32c53d92cc97632491`
- **License:** GPL-3.0-only
- **Version:** 1.1.0
- **Price:** free (`price_usd: "0"`)

The published asset was downloaded again after release and its checksum and
archive contents were verified.

## Submission files

| Path | Purpose |
|------|---------|
| `submission/authors/gitdamnit.json` | Author record (`authors/gitdamnit.json` upstream) |
| `submission/items/bludit-wizard/metadata.json` | Plugin item metadata (`items/bludit-wizard/metadata.json`) |
| `submission/items/bludit-wizard/screenshot.png` | 800×600 screenshot from the approved interface |

Both JSON files match the official templates' keys. The author file is named for
the maintainer identity `gitdamnit`; there is no duplicate author record.

## Verification performed before submission

- GitHub repository exists and is public; default branch `main`.
- Tag `v1.1.0` exists; release is published (not draft, not prerelease).
- Release asset `bludit-wizard-1.1.0.zip` downloads and matches the recorded
  SHA-256.
- Archive contains a single `wizard/` directory with `plugin.php`,
  `metadata.json`, `languages/`, `js/`, `css/`, `lib/`, README, CHANGELOG,
  LICENSE and `assets.json`.
- `metadata.json` reports version 1.1.0 and license GPL-3.0-only.
- Screenshot is 800×600 RGB and shows the current workspace with no credentials.
- Download URL in the item metadata points at the verified GitHub release asset.

## If the directory requests changes

Update the fork branch `gitdamnit:add-bludit-wizard-v1.1.0`, re-validate the JSON
against the current upstream templates, and report the new PR state. Do not
describe the submission as accepted until the listing appears in the official
directory.
