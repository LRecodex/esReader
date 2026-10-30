# Changelog

## 1.0.5 (2026-10-30)

- Ignore outdated story and chapter responses when navigating quickly.
- Validate saved reading appearance preferences before applying them.
- Restore the window's size and position when esReader starts, keeping it visible after display changes.
- Restrict privileged IPC calls to the application renderer and block navigation away from the reader.
- Prevent reader arrow-key shortcuts from interfering with modified shortcuts or browser scrolling.

## 1.0.4 (2026-10-30)

- Sync reading position to esTory and resume from the last synced chapter and percentage.
- Save multiple bookmarks per story, each with its own chapter and percentage, and jump to or remove saved places.
- Preserve existing device bookmarks by migrating them to the esTory account.
- Open a story overview when selecting a library card so readers can choose where to begin.

## 1.0.3 — 2026-10-30

- Added an always-visible toolbar restore button when the reader bar is collapsed.
- Displayed the installed app version in the toolbar and library footer.
- Loaded uploaded story cover images in the library cards, with cleaner placeholders when a story has no cover.

## 1.0.2 — 2026-10-30

- Accept usernames as well as email addresses in the esTory sign in form.

## 1.0.1 — 2026-10-30

- Fixed a startup crash caused by the auto updater's CommonJS module import.

## 1.0.0 — 2026-10-30

- Added esTory account sign in for the authenticated reading room.
- Added update checks on launch and every 15 minutes, with manual checking, download, and restart actions.
- Added the original esReader app icon.
- Added local reading position, bookmarks, and appearance preferences.
