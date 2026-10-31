# Novex Launcher

A clean, minimal Minecraft launcher for Windows, macOS and Linux. Built with Tauri 2 (Rust) and React.

## Layout

```
apps/launcher/          Tauri app
  src/                  React UI (screens, components, design tokens in styles.css)
  src-tauri/            Rust backend
.github/workflows/      CI checks and cross-platform release builds
```

## Requirements

- Node.js 20+ and Rust (stable)
- **macOS:** Xcode Command Line Tools
- **Windows:** Microsoft C++ Build Tools and WebView2, which is already on Windows 11
- **Linux:** `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`

## Develop

```bash
cd apps/launcher
npm install
npm run tauri dev
```

`npm run dev` alone opens the UI in a browser without the Rust backend.

## Build installers

```bash
cd apps/launcher
npm run tauri build
```

| OS | Output |
|---|---|
| Windows | NSIS `.exe` (per-user), `.msi` |
| macOS | `.app`, `.dmg` |
| Linux | `.AppImage`, `.deb`, `.rpm` |

To release, push a `v*` tag. `release.yml` builds macOS (universal), Windows x64/ARM64 and Linux x64/ARM64 into a draft GitHub Release.

## Icons

`apps/launcher/app-icon.png` is a placeholder. To swap it, replace the file and regenerate every size:

```bash
npm run tauri icon app-icon.png
```
