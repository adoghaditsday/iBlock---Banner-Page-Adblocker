# iBlock – Banner and Page Ad Blocker

A Manifest V3 Chrome extension that blocks supported third-party advertising requests and removes high-confidence banner, popup, native, and rich-media advertising outside protected video players.

<img width="256" height="256" alt="logo-256" src="https://github.com/user-attachments/assets/9834e79e-ee12-4a2e-966e-e7473e3f492b" />


## Scope

iBlock is deliberately narrower than a universal ad blocker. Its primary goals are:

- block known third-party advertising and tracking endpoints;
- reduce banners, popups, native-ad widgets, and rich-media promotions;
- protect detected video players, navigation, controls, content grids, and same-site cards;
- provide conservative **Regular** and stronger **Super** modes;
- allow up to 50 whitelisted sites.

It does not promise to remove every advertisement, bypass anti-adblock systems, or alter server-inserted advertisements inside video streams.

## Repository layout

```text
extension/          Chrome extension loaded by Chrome or submitted to the Web Store
extension/rules/    Manifest V3 declarativeNetRequest rulesets
docs/               Architecture, privacy, permissions, testing, and release notes
scripts/            Validation and release-packaging scripts
store-assets/       Logo and promotional images
tools/              Optional developer utilities for filter-list conversion
```

## Load the extension locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the `extension` directory.

## Modes

### Regular

Enables the core advertising-domain rules and rich-media rules. DOM cleanup uses high-confidence candidates only.

### Super

Adds popup/redirect, native-ad, and aggressive streaming-site rules. Protected players and essential page regions remain excluded from DOM cleanup.

## Validate the repository

Requires Node.js 18 or newer.

```bash
npm run validate
```

## Build a release zip

```bash
npm run package
```

The distributable archive is written to `dist/iblock-banner-page-ad-blocker-v<version>.zip` and contains only the contents of `extension/`.

## Privacy

The extension stores its mode, whitelist, and preferences locally using `chrome.storage.local`. It does not include analytics, an account system, or remote telemetry. See [docs/PRIVACY.md](docs/PRIVACY.md).

## Filter-list reference

The optional `tools/build_from_hagezi.mjs` utility can convert compatible domain lists into DNR rules for local development. Generated lists are not bundled automatically. Review upstream licensing, rule limits, false positives, and Chrome Web Store policy before distributing generated rules.

## License

Source code is released under the MIT License. Third-party lists and data retain their own licenses and terms.
