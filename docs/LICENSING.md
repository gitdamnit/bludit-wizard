# Licensing

Bludit Wizard v1.1.0 is licensed under the **GNU General Public License,
version 3 only** — SPDX identifier `GPL-3.0-only`.

Copyright © 2026 Evan Zellner.

## License text

`LICENSE` (repository root and `wizard/LICENSE` in the distribution) contains the
official GNU General Public License version 3 text, retrieved from
<https://www.gnu.org/licenses/gpl-3.0.txt>:

- SHA-256: `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`
- 674 lines, 35,149 bytes
- Includes the complete terms and the "How to Apply These Terms" appendix.

The plugin metadata, README, source headers and Bludit directory metadata use
the same `GPL-3.0-only` identifier.

## Third-party audit

| Component | Distribution | License / status |
|-----------|--------------|------------------|
| Bludit Wizard PHP, JavaScript, CSS, language file and network-policy library | Shipped in the ZIP | Original work by Evan Zellner; GPL-3.0-only |
| Bludit CMS core, admin theme, Bootstrap, jQuery, Line Awesome and other admin assets | **Not redistributed**; provided by the installed Bludit site | Bludit is GPLv3; no Bludit files are copied into this plugin |
| Playwright / Playwright browsers | Development and test only | Apache-2.0; not shipped |
| Node.js, npm packages and Docker images | Development and test only | Not shipped |
| Screenshots in `docs/screenshots/` and `submission/` | Documentation / directory submission | Captured from this plugin's own interface; no third-party artwork |
| PHP, Apache and Debian base images | Test harness only | Not shipped |

No third-party runtime library, font, icon set or code snippet is bundled in the
plugin archive. No dependency is mislabelled as GPL.

## Compatibility

The plugin's GPL-3.0-only license is compatible with Bludit's GPLv3 licensing and
with the GPLv3 plugin ecosystem. The plugin communicates with external AI
providers over HTTP; it does not link to or redistribute their SDKs.

## Historical releases

Releases up to and including 1.1.0 RC2 were published under the MIT license.
Those historical artifacts and their license notices remain valid for the code
they contain. The stable v1.1.0 release and later releases are GPL-3.0-only.
