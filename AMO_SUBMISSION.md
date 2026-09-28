# AMO submission text

## Add-on name

Message Bookmarks for ChatGPT

This wording makes the add-on's third-party relationship clear. Do not describe it as official or endorsed by OpenAI.

## Short description

Bookmark, rename, and quickly revisit individual messages in long ChatGPT conversations.

## Full description

Message Bookmarks for ChatGPT adds a small bookmark control to user and assistant messages on chatgpt.com. Saved messages appear in a compact right-hand panel for the current conversation, where they can be renamed, removed, or selected to scroll back to the original message.

Bookmarks are separated by ChatGPT conversation ID. The extension stores only compact navigation metadata, including a short title and preview, in Firefox WebExtension storage. It uses Firefox sync storage when available and local extension storage as a fallback.

This is an independent third-party utility and is not affiliated with or endorsed by OpenAI.

## Privacy statement

This extension does not collect or transmit user data to the developer. It does not use analytics, telemetry, advertising, tracking, or external servers. It makes no network requests.

Bookmark metadata is stored in Firefox WebExtension storage. The extension primarily uses `browser.storage.sync`, so Firefox may synchronize that metadata through the user's Mozilla account according to the user's Firefox Sync settings. If sync storage is unavailable or a write fails, the extension uses `browser.storage.local` on the current Firefox profile. Full message bodies are not intentionally stored; previews are limited to 200 characters.

## Permissions justification

### `storage`

Required to save bookmark metadata and user-edited labels in `browser.storage.sync`, with `browser.storage.local` as a safe fallback.

### `https://chatgpt.com/*`

Required to run the bundled content scripts and styles that discover messages, add bookmark buttons, and render the bookmark panel on ChatGPT. No other website access is requested.

### Data collection declaration: `none`

The extension does not collect or transmit data outside the extension. It has no network code, analytics, telemetry, or developer-operated service. Firefox Sync behavior is provided by Firefox through `browser.storage.sync` and is disclosed to users.

## Reviewer notes

1. Install the extension in Firefox Desktop 140 or newer (Firefox for Android requires 142 or newer).
2. Open `https://chatgpt.com` and sign in with a reviewer-controlled account if necessary.
3. Open an existing conversation at a `/c/<conversation-id>` URL.
4. Use the bookmark-outline button added beside a user or assistant message's action controls.
5. Open the right-hand bookmark panel using the floating button or Alt+Shift+B.
6. Click the saved bookmark and verify smooth-scroll navigation and temporary highlighting.
7. Use the pencil button to rename the bookmark; Enter saves and Escape cancels.
8. Use the remove button and confirm the message control returns to its outline state.
9. Open another conversation and confirm only its bookmarks appear.

The extension contains no remote code, network requests, analytics, telemetry, external libraries, minified code, or build step. Runtime source is plain JavaScript and CSS loaded directly by `manifest.json`. `web-ext build` only packages these readable files into a ZIP.

## Reproducible validation/package commands

```bash
npm install
npm test
npm run lint
npm run build
```

`web-ext` is a development-only dependency and is not included in the extension package.
