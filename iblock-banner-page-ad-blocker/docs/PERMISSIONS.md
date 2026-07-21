# Chrome Web Store Permission Justifications

## Single purpose

iBlock – Banner and Page Ad Blocker has one purpose: blocking supported third-party advertising requests and reducing high-confidence banner, popup, native, and rich-media advertising outside protected video players while preserving normal webpage functionality.

## `storage`

Used to save the user's enabled state, selected filtering mode, video-player protection preference, whitelist, and local site log. These settings persist between browser sessions. The extension does not use this permission for remote analytics or data transmission.

## `tabs`

Used to identify the active tab's hostname so the popup can display the current site, determine whether it is whitelisted, and add or remove that site from the whitelist. It is not used to create a browsing-history profile.

## `declarativeNetRequest`

Used to apply Manifest V3 rules that block supported advertising, tracking, popup, native-ad, and rich-media requests before they complete. This is a core part of the extension's advertised function.

## `declarativeNetRequestWithHostAccess`

Used to apply request-blocking rules on websites covered by the extension's host permissions. This limits request filtering to hosts where the extension is authorized to operate.

## Host permission: `<all_urls>`

Required because banner and page advertising can appear on any website. Host access allows the content script to identify and hide supported ad elements, protect video players and essential controls, honor the site whitelist, and apply request filtering across visited sites. Processing occurs locally in Chrome.
