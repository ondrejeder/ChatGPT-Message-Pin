# Message Bookmarks for ChatGPT

A small, third-party Firefox extension for bookmarking individual user and assistant messages inside a ChatGPT conversation. It is not affiliated with or endorsed by OpenAI.

## Features

- Bookmark individual user and assistant messages.
- Open a new chat in another browser tab with the small icon beside New chat.
- View only the bookmarks belonging to the currently open conversation.
- Navigate back to a message with smooth scrolling and a brief highlight.
- Rehydrate virtualized turns before jumping; older bookmarks use a bounded scroll search (up to 30 seconds). Manual scrolling cancels the search.
- Rename and remove bookmarks from a right-hand panel.
- Survive page reloads and ChatGPT single-page navigation.
- Support both ordinary conversations and conversations inside projects.
- Sync between desktop Firefox profiles when Firefox Add-ons Sync is enabled.
- Fall back safely to local extension storage when sync storage is unavailable or full.
- Work in light and dark themes with keyboard-accessible controls.

The panel shortcut is **Alt+Shift+B**. The originally considered Alt+B shortcut conflicts with Firefox's native Bookmarks menu on Windows and Linux.

## Privacy

The extension sends no data to the developer, uses no analytics or telemetry, and communicates with no external servers. It stores only compact bookmark metadata: a short title and preview, message identifiers/hash, role, index, and creation time. Full message bodies are not intentionally stored.

Bookmark metadata remains in Firefox WebExtension storage. Firefox may synchronize `browser.storage.sync` data through the user's Mozilla account when the user has enabled Add-ons Sync. This is Firefox Sync, not a cloud service operated by this extension. If sync storage cannot be used, the extension stores that conversation's bookmarks in `browser.storage.local` on the current Firefox profile.

## Permissions

### `storage`

Stores message bookmarks and their labels using Firefox `storage.sync`, with `storage.local` as a fallback.

### `https://chatgpt.com/*`

Allows the bundled content scripts and styles to add bookmark controls only to ChatGPT pages. The extension does not request access to other websites.

The manifest declares `data_collection_permissions.required: ["none"]` because the extension does not collect or transmit data outside the extension/Firefox Sync behavior described above.

## Project structure

```text
manifest.json
src/
  storage.js   Firefox sync/local storage abstraction
  messages.js  Centralized ChatGPT DOM discovery and message matching
  ui.js        Panel, message controls, rename UI, and highlighting
  content.js   State, SPA navigation, observer, and event orchestration
  styles.css   Namespaced light/dark UI styles
icons/         Original extension artwork
tests/         Dependency-free logic and package checks
```

There is no runtime dependency, framework, bundler, transpiler, minification, remote code, or build transformation. The AMO package contains the same readable runtime files as this repository.

## Development

Requirements: Node.js 20 or newer, npm, Firefox Desktop 140 or newer, or Firefox for Android 142 or newer.

```bash
npm install
npm test
npm run lint
npm start
```

Equivalent global `web-ext` commands from the project directory are:

```bash
npm install --global web-ext
web-ext run
web-ext lint --warnings-as-errors
web-ext build --overwrite-dest
```

For the optional local UI fixture, run `npm run test:ui:server` and open `http://127.0.0.1:41777/c/test-conversation`. It exercises the real runtime files with a browser-storage mock and never contacts ChatGPT.

For a normal development launch, `npm start`/`web-ext run` opens a temporary test profile. The published add-on must be signed by Mozilla before regular installation in release Firefox.

## Create the AMO package

```bash
npm run build
```

The ZIP is written to `web-ext-artifacts/`. The configuration excludes repository documentation, tests, package-manager files, and the SVG icon source; the package contains only the files Firefox executes plus the required PNG icons.

## Manual test checklist

1. Open an existing long conversation at `https://chatgpt.com/c/...`.
2. Bookmark both a user message and an assistant message.
3. Open the panel with its floating button and with Alt+Shift+B.
4. Navigate to both messages, rename one bookmark, and delete the other.
5. Reload and confirm the remaining bookmark persists.
6. Navigate to a different conversation and confirm bookmarks do not leak between chats.
7. Navigate back and verify the first conversation's bookmark returns.
8. Generate a streaming reply and confirm only one bookmark control appears.
9. Check light and dark themes and keyboard focus states.
10. Run `npm test`, `npm run lint`, and `npm run build`.

## AMO publishing

1. Complete the manual tests above.
2. Run `npm test` and `npm run lint`.
3. Run `npm run build` and inspect the generated ZIP.
4. Create or sign in to a Mozilla Add-ons developer account.
5. Submit a new add-on at addons.mozilla.org.
6. Choose listed/public distribution.
7. Upload the ZIP and copy the listing text from `AMO_SUBMISSION.md`.
8. Complete validation and answer reviewer questions if any.
9. Mozilla reviews and signs the accepted extension; install the signed release normally from AMO.
10. For every update, keep the same extension ID, increment `version` in `manifest.json`, validate again, and upload the new package.

Because the shipped code is plain, readable source with no generated runtime code, a separate source archive and reproduction build are generally unnecessary. Follow any instructions shown by AMO during submission if its review form requests additional material.

## Known maintenance boundary

ChatGPT is a frequently changing single-page application. Message discovery prefers the semantic `data-message-author-role` and `data-message-id` attributes, and all site-specific selectors are centralized in `src/messages.js`. If ChatGPT removes those attributes, that module will need an update. Existing bookmarks retain ID, role, normalized-text hash, and message-index fallbacks, but navigation cannot succeed if the original message is no longer present in the rendered conversation.

## License

MIT © 2026 Ondrej Eder
