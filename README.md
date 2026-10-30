# esReader

A slim Electron reading window for published stories on [esTory](https://estory.fauzulazim.com/). Sign in with your esTory account to browse your stories and published chapters.

## Run locally

```powershell
npm install
npm run dev
```

## Build the Windows installer

```powershell
npm run dist
```

The installer is written to `release/esReader-Setup-1.0.0.exe`.

## Server requirement

The reader signs in through esTory's `/api/auth/login` route and loads the signed-in account's reader routes. Only published chapter text is displayed. Session credentials remain in memory while the app is open; sign in again after restarting esReader.

The app remembers display preferences, the last chapter, reading position, and bookmarks on this Windows device. Its compact frameless window can be resized. Use the top bar's hide button to collapse the app chrome; move over the top edge to reveal it again. `Ctrl+B` toggles the bar, and left/right arrow keys turn pages.

Packaged builds check GitHub Releases for updates on launch and every 15 minutes. Use the refresh button in the title bar to check manually; available updates can be downloaded and installed from that same button.
