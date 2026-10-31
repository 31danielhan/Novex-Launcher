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
- **Linux:** `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev libdbus-1-dev pkg-config patchelf`

## Develop

```bash
cd apps/launcher
npm install
npm run tauri dev
```

`npm run dev` alone opens the UI in a browser without the Rust backend.

Dev builds can add **offline accounts** (Accounts → "Offline name") so you can test launching without Microsoft sign-in. Release builds hide this option.

## Microsoft sign-in setup

1. Register an app at [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade). For supported account types, choose **Personal Microsoft accounts only**.
2. Under **Authentication**, set **Allow public client flows** to **Yes** (sign-in uses the device-code flow).
3. Apply for Minecraft API access for that app ID: <https://aka.ms/mce-reviewappid>. Until Mojang approves it, the final step of sign-in fails.
4. Build or run with the client ID:

```bash
NOVEX_MSA_CLIENT_ID=<your-client-id> npm run tauri dev
```

For release builds, add `NOVEX_MSA_CLIENT_ID` as a GitHub Actions secret and expose it as an env var in `release.yml`.

## Launch smoke test

Downloads a version into a scratch folder, launches it with an offline account, and checks that it reaches the title screen and is still running after the given number of seconds:

```bash
cd apps/launcher/src-tauri
cargo run --example launch -- latest /tmp/novex-smoke 90
```

Add a loader (`fabric`, `quilt`, `forge`, `neoforge`) and optionally a loader version. Without a version it uses the recommended or newest stable build:

```bash
cargo run --example launch -- 1.20.1 /tmp/novex-smoke 90 forge
```

Set `NOVEX_JVM_ARGS` to try extra JVM flags.

## Loader support

| Loader | Versions | Status on macOS (Apple Silicon) |
|---|---|---|
| Fabric | 1.14+, and 1.3–1.13.2 through Legacy Fabric | Tested on 26.3 and 1.8.9 |
| Quilt | Whatever Quilt publishes | Tested on 1.21.1. Quilt has no build that runs on 26.3 yet |
| Forge | 1.13+ via the installer's processors; 1.12.2 and older via `versionInfo` | Tested on 26.3 and 1.20.1 |
| NeoForge | 1.20.2+ | Tested on 26.3 |

**Known issue:** Forge 1.8.9 (and probably other Forge versions up to 1.12.2) installs fine but crashes on Apple Silicon Macs with `glCheckFramebufferStatus returned unknown status:0`. It runs under Rosetta with Intel Java 8. Turning off Forge's splash screen and `-Dforge.forceNoStencil=true` didn't help. Legacy Fabric 1.8.9 works on the same machine, so the next step is to try its patched LWJGL build for old Forge. This hasn't been tested on Intel Macs, Windows or Linux.

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
