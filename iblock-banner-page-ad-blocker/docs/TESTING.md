# Release Test Matrix

Test in a fresh Chrome profile with no other blockers installed.

## Functional checks

- Install as an unpacked extension without manifest or ruleset errors.
- Popup opens and displays the active hostname.
- Regular and Super modes change enabled rulesets.
- Whitelist add/remove works and persists after restart.
- Whitelisted sites reload without DOM filtering or blocked initiated requests.
- Options page enforces the 50-site whitelist limit.

## Compatibility checks

Verify that each page type loads on the first attempt and remains usable:

- Twitch: player, chat, navigation, channel list.
- YouTube: player, thumbnails, comments, menus.
- NexusMods: listing cards, images, lightboxes, filters.
- article/documentation site: body text, images, navigation.
- shopping site: product cards, cart controls, filters.
- forum/community site: posts, comments, menus.

## Blocking checks

Use reproducible pages containing supported third-party banners or native-ad widgets. Verify that at least one request in the bundled rulesets is blocked and that off-player high-confidence ad elements are removed without affecting nearby content.
