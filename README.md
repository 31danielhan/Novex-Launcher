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

For release builds, add `NOVEX_MSA_CLIENT_ID` as a GitHub Actions secret. `release.yml` passes it to the build.

## Mods and modpacks

Browse searches Modrinth (no setup needed) and CurseForge. Mods, resource packs and shaders install into an instance, filtered to its Minecraft version and loader, with required dependencies. Modpacks install as new instances. Instances → Import takes a `.mrpack` or a CurseForge modpack `.zip`.

CurseForge needs an API key from the [CurseForge console](https://console.curseforge.com/). Set it like the Microsoft client ID:

```bash
NOVEX_CURSEFORGE_API_KEY=<your-key> npm run tauri dev
```

For releases, add it as the `NOVEX_CURSEFORGE_API_KEY` GitHub Actions secret. Without a key the CurseForge tab says so and Modrinth still works. Some CurseForge authors block downloads from launchers; those files are listed after a modpack installs so they can be downloaded by hand.

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

Set `NOVEX_JVM_ARGS` to try extra JVM flags, or `NOVEX_JAVA` to use a specific Java binary.

The `content` example drives search, installs and modpacks from the command line (see the top of `examples/content.rs`). Launch what it created with:

```bash
cargo run --example launch -- instance:<id> /tmp/novex-smoke 90
```

## Loader support

| Loader | Versions | Status on macOS (Apple Silicon) |
|---|---|---|
| Fabric | 1.14+, and 1.3–1.13.2 through Legacy Fabric | Tested on 26.3 and 1.8.9 |
| Quilt | Whatever Quilt publishes | Tested on 1.21.1. Quilt has no build that runs on 26.3 yet |
| Forge | 1.13+ via the installer's processors; 1.12.2 and older via `versionInfo` | Tested on 26.3, 1.20.1 and 1.8.9 |
| NeoForge | 1.20.2+ | Tested on 26.3 |

**Old Forge on macOS:** Forge 1.12.2 and older gets two special cases on macOS:

- It launches **without** `-XstartOnFirstThread`. Otherwise Forge's launchwrapper leaves the OpenGL context on the wrong thread and startup fails with `glCheckFramebufferStatus returned unknown status:0`.
- It uses [Legacy Fabric's LWJGL 2 fork](https://maven.legacyfabric.net/) instead of Mojang's LWJGL 2.9.2. Without the first-thread flag, 2.9.2 randomly crashes while creating the window (SIGSEGV in `MacOSXContextImplementation.setView`).

Vanilla and Fabric keep the flag and Mojang's libraries.

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

## Updates

Installed launchers update themselves from GitHub Releases. Everything is signed with one key pair; the public key is in `tauri.conf.json` (`plugins.updater.pubkey`), and the app refuses anything it didn't sign.

- **App updates:** publishing a release made by `release.yml` makes it "latest". Apps read its `latest.json`, then download, verify, install and restart. On Linux only the AppImage updates itself; `.deb` and `.rpm` installs update through the package manager.
- **Interface updates:** pushing a `ui-v0.1.1` tag runs `ui-release.yml`, which builds the frontend, signs it and uploads it to the rolling `ui-latest` pre-release. Apps use it only when it is newer than their built-in interface and built for the same command API (`src-tauri/ui-api`). Bump that number whenever Tauri commands change. A bundle that fails to start is dropped on the next launch, and Settings → Updates can switch back to the built-in interface.

### Setup

1. Keep the private key safe: `~/.tauri/novex-updater.key`. If it's lost, existing installs can never update again. If it leaks, anyone can ship updates to your users.
2. Add GitHub Actions secrets:
   - `TAURI_SIGNING_PRIVATE_KEY`: the contents of that file.
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: only if the key has a password. Leave it out otherwise.
3. Optional macOS signing and notarization (Apple Developer account): `APPLE_CERTIFICATE` (base64 .p12), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` (app-specific password) and `APPLE_TEAM_ID`. Missing secrets are skipped, and the build stays unsigned.
4. Windows code signing isn't set up. Unsigned installers show a SmartScreen warning until the app builds reputation or is signed (for example with Azure Trusted Signing).

Builds made by GitHub Actions look for updates in the repository they were built in. Set `NOVEX_UPDATE_REPO=owner/name` to build elsewhere. Local builds without it say updates aren't set up.

To test locally, point a debug build at your own server with `NOVEX_UPDATE_ENDPOINT` (a `latest.json` URL) and `NOVEX_UI_MANIFEST_URL` (a `ui-bundle.json` URL). Signatures are still required. `examples/ui_bundle.rs` checks the interface update flow against such a server.

## Icons

`apps/launcher/app-icon.png` is a placeholder. To swap it, replace the file and regenerate every size:

```bash
npm run tauri icon app-icon.png
```
