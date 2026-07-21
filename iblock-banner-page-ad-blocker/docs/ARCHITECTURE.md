# Architecture

## Request filtering

The extension uses Manifest V3 `declarativeNetRequest` static rulesets. Regular mode enables conservative domain-focused lists. Super mode enables additional popup, native-ad, and streaming-ad rules.

The extension does not alter the operating-system DNS resolver. Its sinkhole-like behavior is limited to Chrome request filtering.

## Page filtering

`content.js` starts at `document_idle`, requests the active configuration from the service worker, protects player and interface regions, waits briefly, then evaluates only likely ad candidates. A bounded mutation observer handles late-inserted candidates.

## Site profiles

- `safe_video_platform`: minimizes DOM changes on Twitch and YouTube-family hosts.
- `content_grid_safe`: protects repeated same-site listing and gallery cards.
- `generic`: uses normal high-confidence filtering.

## Whitelist

Whitelisted domains receive high-priority session `allow` rules for initiated traffic, while the content script exits before filtering. Whitelist entries also apply to subdomains.
