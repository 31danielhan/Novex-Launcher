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

**Offline accounts** (Accounts → "Offline account") work once a Microsoft account that owns Minecraft is signed in, as in other launchers. Dev builds allow them without one, for testing.

## Microsoft sign-in setup

1. Register an app at [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade). For supported account types, choose **Personal Microsoft accounts only**.
2. Under **Authentication**, set **Allow public client flows** to **Yes** (sign-in uses the device-code flow).
3. Apply for Minecraft API access for that app ID: <https://aka.ms/mce-reviewappid>. Until Mojang approves it, the final step of sign-in fails.
4. Build or run with the client ID:

```bash
NOVEX_MSA_CLIENT_ID=<your-client-id> npm run tauri dev
```

For release builds, add `NOVEX_MSA_CLIENT_ID` as a GitHub Actions secret. `release.yml` passes it to the build.

## Novex Client

`apps/client/` is Novex Client, a client-side HUD mod: FPS, CPS, ping, coordinates, keystrokes, armor and potion HUDs, toggle sprint, zoom and motion blur. The 1.8.9 build adds 1.7 block hit and eating animations, damage tilt and FOV effect switches, a cleaner scoreboard sidebar and a build height warning. Right Shift opens and closes its menu in game; settings live in `config/novex-client.json`. It works alongside Sodium and Embeddium.

| Loader | Minecraft versions |
|---|---|
| Fabric, Quilt | 1.20.1, 1.20.4, 1.21.1, 1.21.4, 1.21.5, 1.21.8, 1.21.11, 26.1.2, 26.2, 26.3 |
| NeoForge | 1.21.1, 1.21.11, 26.3 |
| Forge | 1.8.9, 1.20.1 |

The HUD itself is in `apps/client/core` (plain Java 8, no Minecraft code). Each folder in `apps/client/versions/` is a small adapter for one loader and version with its own Gradle build. All of them use the shared wrapper, except `forge-1.8.9`, which has its own Gradle 8.8 wrapper. Fabric adapters use mixins for clicks and zoom; NeoForge and Forge use the loader's own events for those. Motion blur is camera motion blur: each frame the mod writes the camera's turn into a small texture, and a post-processing shader blurs each pixel along the path the turn moved it (no frame blending, so no ghost copies). Each target has the shader in its resources and a mixin that runs it after the world is drawn; `core/.../MotionBlur.java` explains the texture format. The jar on an instance is replaced with the launcher's build before every launch, so updating the launcher updates the client.

`./build-all.sh` builds every target and copies the jars to `apps/launcher/src-tauri/resources/client/`, which the launcher embeds when it compiles. The Novex Client page then turns the matching jar on per instance and installs Fabric API, plus Sodium or Embeddium where Modrinth has them. Pass target names to build only those, for example `./build-all.sh fabric-26.3`.

Testing:

- `./gradlew runClientGameTest` in a Fabric folder from 1.21.4 up opens a world and saves screenshots to `build/run/clientGameTest/screenshots/`.
- `./boot-check.sh <target>` starts any target's dev client and reports whether it reached the title screen. On 1.20.1 and 26.1.2, add `GRADLE_ARGS=-PnoSodium`: those Sodium builds clash with the dev environment.

Building needs JDK 21 and JDK 25 or newer. The 1.8.9 target downloads its own JDK 8 through Gradle.

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

## License

Novex Launcher and Novex Client are free software under the [GNU General Public License v3.0](LICENSE) (GPL-3.0-only). You can use, study, change and share them, as long as anything you distribute that's based on them is also released under GPL-3.0 with its source code.

## Credits

- [OneLauncher / OneClient](https://github.com/Polyfrost/OneLauncher) by Polyfrost (GPL-3.0): design reference for the launcher and the in-game menu, the source of the Poly theme (colours, radii and motion from its PolyGlass themes), and of the performance mods installed with Novex Client (picked from its performance bundles). Code taken from it is marked in the source files it appears in.
- [OneConfig](https://github.com/Polyfrost/OneConfig) by Polyfrost (LGPL-3.0 with Additional Terms, used here under the GPL-3.0): the in-game menu's colours, radii, layout, cards, switches and page animation are adapted from its interface code.
- [Ornithe](https://ornithemc.net) (Fabric Loader for old versions) runs the 1.8.9 Ornithe build. Its 1.8.9 launch profile comes from Polyfrost's metadata server, the same one OneClient uses, which runs the game on Java 25 with [Legacy Fabric](https://legacyfabric.net)'s LWJGL 2. The 1.8.9 Ornithe build compiles against names made by joining Ornithe's Calamus intermediary with MCP stable 22.
- 1.8.9 performance mods, downloaded from their authors' Modrinth or GitHub pages when Novex Client is installed: [Pylon](https://modrinth.com/mod/pylon) (LWJGL 3), [Slipstream](https://modrinth.com/mod/slipstream), [Exploint](https://modrinth.com/mod/exploint), [Async Logger](https://modrinth.com/mod/asynclogger), [Legacy Dynamic FPS](https://modrinth.com/mod/dynamic-fps), [Windows Priority Boost](https://modrinth.com/mod/windows-priority-boost), Polyfrost's [Argentum, Argentum Extras, Cera](https://github.com/Polyfrost/Argentum) and [Sarcio](https://github.com/Polyfrost/Sarcio), and [SoundFix](https://github.com/saadndm/soundfix). Novex doesn't ship any of them.
- [Monocraft](https://github.com/IdreesInc/Monocraft) by Idrees Hassan (SIL Open Font License 1.1): the Minecraft theme's font.
- [Poppins](https://github.com/itfoundry/Poppins) by Indian Type Foundry (SIL Open Font License 1.1): the in-game menu and Poly theme font.
- [Lucide](https://lucide.dev) (ISC License): the in-game menu's line icons, shipped as a font cut down to the icons Novex uses.
- [mediaremote-adapter](https://github.com/ungive/mediaremote-adapter): the idea behind the Now playing module's macOS helper (`apps/client/tools/now-playing`), which reads what's playing by loading a small library into `/usr/bin/perl`. Novex's helper is its own code.
- Version backgrounds: screenshots by Xbox México and Xbox MENA from Wikimedia Commons, CC BY 3.0.

Novex is not affiliated with or endorsed by Mojang, Microsoft or Polyfrost.
