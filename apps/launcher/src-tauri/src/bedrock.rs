//! Minecraft: Bedrock Edition, on Windows only.
//!
//! Novex doesn't install or download Bedrock: the player installs it from the Microsoft Store or
//! the Xbox app with their own Microsoft account, which is how ownership is checked. Novex starts
//! the installed game and, with the client turned on, loads a client DLL into it.
//!
//! The injection is kept careful:
//! - the DLL must be a 64-bit Windows DLL, checked before anything is loaded;
//! - Latite is downloaded only from its official GitHub release and checked against the SHA-256
//!   that GitHub publishes for it;
//! - DLLs are copied into Novex's own folder first, so the player's file is never changed;
//! - only Minecraft's own process is touched, and nothing is loaded twice;
//! - the memory used to pass the path is always freed, and a load failure is reported.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tauri::State;

use crate::error::{msg, Result};
use crate::AppState;

const PROCESS: &str = "Minecraft.Windows.exe";
const LATITE_RELEASE: &str = "https://api.github.com/repos/LatiteClient/Latite/releases/latest";
const LATITE_ASSET: &str = "Latite.dll";

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClientChoice {
    #[default]
    Latite,
    Custom,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BedrockConfig {
    pub client_enabled: bool,
    pub client: ClientChoice,
    /// The player's own DLL, for ClientChoice::Custom.
    pub custom_dll: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BedrockStatus {
    /// Bedrock only runs on Windows.
    pub supported: bool,
    pub installed: bool,
    pub version: Option<String>,
    pub running: bool,
    pub config: BedrockConfig,
    /// The Latite release downloaded, if any.
    pub latite_version: Option<String>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct LatiteCache {
    tag: String,
    sha256: String,
}

fn folder(state: &AppState) -> PathBuf {
    state.paths.root.join("bedrock")
}

fn read_config(state: &AppState) -> BedrockConfig {
    std::fs::read(folder(state).join("config.json"))
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

fn read_latite(state: &AppState) -> Option<LatiteCache> {
    std::fs::read(folder(state).join("latite.json"))
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
}

fn running() -> Option<u32> {
    use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};
    let mut sys = System::new();
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing());
    sys.processes()
        .values()
        .find(|p| p.name().eq_ignore_ascii_case(PROCESS))
        .map(|p| p.pid().as_u32())
}

async fn status(state: &AppState) -> BedrockStatus {
    let supported = cfg!(windows);
    let version = if supported {
        installed_version().await
    } else {
        None
    };
    BedrockStatus {
        supported,
        installed: version.is_some(),
        version,
        running: supported && running().is_some(),
        config: read_config(state),
        latite_version: read_latite(state).map(|c| c.tag),
    }
}

/// The installed Bedrock version, from its Store package.
#[cfg(windows)]
async fn installed_version() -> Option<String> {
    let out = tokio::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "(Get-AppxPackage -Name Microsoft.MinecraftUWP | Select-Object -First 1).Version",
        ])
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
        .output()
        .await
        .ok()?;
    let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
    (!v.is_empty()).then_some(v)
}

#[cfg(not(windows))]
async fn installed_version() -> Option<String> {
    None
}

/// Whether these bytes are a 64-bit (x64) Windows DLL. Minecraft is x64, so anything else
/// could never load and isn't worth the try.
pub fn is_x64_dll(bytes: &[u8]) -> bool {
    let u16_at = |i: usize| {
        bytes
            .get(i..i + 2)
            .map(|b| u16::from_le_bytes([b[0], b[1]]))
    };
    let u32_at = |i: usize| {
        bytes
            .get(i..i + 4)
            .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
    };
    if bytes.get(..2) != Some(b"MZ") {
        return false;
    }
    let Some(pe) = u32_at(0x3C).map(|p| p as usize) else {
        return false;
    };
    if bytes.get(pe..pe + 4) != Some(b"PE\0\0") {
        return false;
    }
    // Machine x64, and the DLL flag in the file characteristics.
    u16_at(pe + 4) == Some(0x8664) && u16_at(pe + 22).is_some_and(|c| c & 0x2000 != 0)
}

fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

/// The latest Latite release, downloaded once per release and checked against GitHub's hash.
/// Without a connection, the last download is used.
async fn latite(state: &AppState) -> Result<PathBuf> {
    let dir = folder(state);
    let file = dir.join(LATITE_ASSET);
    let cached = read_latite(state);
    let release = async {
        let r: serde_json::Value = state
            .http
            .get(LATITE_RELEASE)
            .header("Accept", "application/vnd.github+json")
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        Ok::<_, crate::error::Error>(r)
    }
    .await;
    let release = match release {
        Ok(r) => r,
        Err(e) => {
            return if cached.is_some() && file.exists() {
                Ok(file)
            } else {
                Err(msg(format!("Couldn't reach Latite's releases: {e}")))
            };
        }
    };
    let tag = release["tag_name"].as_str().unwrap_or_default().to_string();
    let asset = release["assets"]
        .as_array()
        .and_then(|a| a.iter().find(|a| a["name"] == LATITE_ASSET))
        .ok_or_else(|| msg("Latite's latest release has no DLL."))?;
    let expected = asset["digest"]
        .as_str()
        .and_then(|d| d.strip_prefix("sha256:"))
        .ok_or_else(|| msg("Latite's release has no checksum, so it wasn't downloaded."))?
        .to_ascii_lowercase();
    if let Some(c) = &cached {
        if c.sha256 == expected && file.exists() {
            return Ok(file);
        }
    }
    let url = asset["browser_download_url"]
        .as_str()
        .filter(|u| u.starts_with("https://github.com/LatiteClient/Latite/releases/download/"))
        .ok_or_else(|| msg("Latite's download link isn't on its official GitHub page."))?;
    let bytes = state
        .http
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .bytes()
        .await?;
    if sha256_hex(&bytes) != expected {
        return Err(msg(
            "Latite's download didn't match its checksum, so it wasn't used.",
        ));
    }
    if !is_x64_dll(&bytes) {
        return Err(msg("Latite's download isn't a 64-bit Windows DLL."));
    }
    tokio::fs::create_dir_all(&dir).await?;
    let part = dir.join("Latite.dll.part");
    tokio::fs::write(&part, &bytes).await?;
    tokio::fs::rename(&part, &file).await?;
    let cache = LatiteCache {
        tag,
        sha256: expected,
    };
    tokio::fs::write(dir.join("latite.json"), serde_json::to_vec(&cache)?).await?;
    Ok(file)
}

/// The player's own DLL, checked and copied into Novex's folder.
async fn custom(state: &AppState, path: &str) -> Result<PathBuf> {
    let source = Path::new(path);
    let bytes = tokio::fs::read(source)
        .await
        .map_err(|e| msg(format!("Couldn't read the client DLL: {e}")))?;
    if !is_x64_dll(&bytes) {
        return Err(msg(
            "That file isn't a 64-bit Windows DLL, so it can't load into Minecraft.",
        ));
    }
    let name = source
        .file_name()
        .and_then(|n| n.to_str())
        .filter(|n| !n.eq_ignore_ascii_case(LATITE_ASSET))
        .unwrap_or("client.dll");
    let dir = folder(state).join("custom");
    tokio::fs::create_dir_all(&dir).await?;
    let file = dir.join(name);
    tokio::fs::write(&file, &bytes).await?;
    Ok(file)
}

#[tauri::command]
pub async fn bedrock_status(state: State<'_, AppState>) -> Result<BedrockStatus> {
    Ok(status(&state).await)
}

#[tauri::command]
pub async fn bedrock_set_config(
    state: State<'_, AppState>,
    config: BedrockConfig,
) -> Result<BedrockStatus> {
    let dir = folder(&state);
    tokio::fs::create_dir_all(&dir).await?;
    tokio::fs::write(dir.join("config.json"), serde_json::to_vec_pretty(&config)?).await?;
    Ok(status(&state).await)
}

/// Starts Bedrock and, with the client on, loads it. Returns what happened, for the UI.
#[tauri::command]
pub async fn bedrock_launch(state: State<'_, AppState>) -> Result<String> {
    if !cfg!(windows) {
        return Err(msg(
            "Minecraft: Bedrock Edition is only available on Windows.",
        ));
    }
    if installed_version().await.is_none() {
        return Err(msg(
            "Minecraft: Bedrock Edition isn't installed. Get it from the Microsoft Store or the Xbox app.",
        ));
    }
    let config = read_config(&state);
    // Get the DLL ready first, so a failed download doesn't leave a half-done launch.
    let dll = if config.client_enabled {
        Some(match config.client {
            ClientChoice::Latite => latite(&state).await?,
            ClientChoice::Custom => {
                let path = config
                    .custom_dll
                    .as_deref()
                    .ok_or_else(|| msg("Choose a client DLL first."))?;
                custom(&state, path).await?
            }
        })
    } else {
        None
    };
    win::launch(dll).await
}

#[cfg(windows)]
mod win {
    use super::*;
    use std::os::windows::ffi::OsStrExt;
    use std::time::Duration;

    pub async fn launch(dll: Option<PathBuf>) -> Result<String> {
        let started = running().is_none();
        if started {
            tokio::process::Command::new("cmd")
                .args(["/C", "start", "", "minecraft:"])
                .creation_flags(0x0800_0000)
                .spawn()?;
        }
        let Some(dll) = dll else {
            return Ok("Minecraft: Bedrock Edition is starting.".into());
        };
        // Wait for the game's process, then give it a moment to finish loading before
        // anything is added to it.
        let mut pid = None;
        for _ in 0..120 {
            if let Some(p) = running() {
                pid = Some(p);
                break;
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
        let pid =
            pid.ok_or_else(|| msg("Minecraft didn't start in time, so the client wasn't loaded."))?;
        if started {
            tokio::time::sleep(Duration::from_secs(6)).await;
        }
        allow_app_packages(&dll).await;
        let name = dll
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        tokio::task::spawn_blocking(move || unsafe { inject(pid, &dll) })
            .await
            .map_err(|e| msg(e.to_string()))??;
        Ok(format!(
            "Minecraft: Bedrock Edition is running with {name}."
        ))
    }

    /// Store versions of Minecraft run sandboxed and can only read files that app packages are
    /// allowed to; harmless where the game isn't sandboxed.
    async fn allow_app_packages(dll: &Path) {
        for sid in ["*S-1-15-2-1:(RX)", "*S-1-15-2-2:(RX)"] {
            let _ = tokio::process::Command::new("icacls")
                .arg(dll)
                .args(["/grant", sid])
                .creation_flags(0x0800_0000)
                .output()
                .await;
        }
    }

    struct Handle(windows_sys::Win32::Foundation::HANDLE);
    impl Drop for Handle {
        fn drop(&mut self) {
            if !self.0.is_null() {
                unsafe { windows_sys::Win32::Foundation::CloseHandle(self.0) };
            }
        }
    }

    /// Whether a module with this file name is already loaded in the process.
    unsafe fn loaded(pid: u32, name: &str) -> bool {
        use windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE;
        use windows_sys::Win32::System::Diagnostics::ToolHelp::*;
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, pid);
        if snap == INVALID_HANDLE_VALUE {
            return false;
        }
        let _snap = Handle(snap);
        let mut entry: MODULEENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<MODULEENTRY32W>() as u32;
        let mut ok = Module32FirstW(snap, &mut entry) != 0;
        while ok {
            let len = entry
                .szModule
                .iter()
                .position(|&c| c == 0)
                .unwrap_or(entry.szModule.len());
            if String::from_utf16_lossy(&entry.szModule[..len]).eq_ignore_ascii_case(name) {
                return true;
            }
            ok = Module32NextW(snap, &mut entry) != 0;
        }
        false
    }

    /// Loads the DLL into Minecraft with LoadLibraryW on a thread in its process.
    unsafe fn inject(pid: u32, dll: &Path) -> Result<()> {
        use windows_sys::Win32::System::Diagnostics::Debug::WriteProcessMemory;
        use windows_sys::Win32::System::LibraryLoader::{GetModuleHandleW, GetProcAddress};
        use windows_sys::Win32::System::Memory::*;
        use windows_sys::Win32::System::Threading::*;

        let name = dll
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        if loaded(pid, &name) {
            return Ok(());
        }
        let wide: Vec<u16> = dll
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let size = wide.len() * 2;

        let process = Handle(OpenProcess(
            PROCESS_CREATE_THREAD
                | PROCESS_QUERY_INFORMATION
                | PROCESS_VM_OPERATION
                | PROCESS_VM_WRITE
                | PROCESS_VM_READ,
            0,
            pid,
        ));
        if process.0.is_null() {
            return Err(msg(
                "Couldn't open Minecraft to load the client. Try running Novex again.",
            ));
        }
        let remote = VirtualAllocEx(
            process.0,
            std::ptr::null(),
            size,
            MEM_COMMIT | MEM_RESERVE,
            PAGE_READWRITE,
        );
        if remote.is_null() {
            return Err(msg("Couldn't make room in Minecraft to load the client."));
        }
        let result = (|| {
            if WriteProcessMemory(
                process.0,
                remote,
                wide.as_ptr().cast(),
                size,
                std::ptr::null_mut(),
            ) == 0
            {
                return Err(msg("Couldn't pass the client to Minecraft."));
            }
            let kernel32: Vec<u16> = "kernel32.dll\0".encode_utf16().collect();
            let load = GetProcAddress(
                GetModuleHandleW(kernel32.as_ptr()),
                c"LoadLibraryW".as_ptr().cast(),
            )
            .ok_or_else(|| msg("Couldn't find LoadLibraryW."))?;
            // LoadLibraryW takes one pointer and returns a handle, like a thread start routine.
            let start: unsafe extern "system" fn(*mut core::ffi::c_void) -> u32 =
                std::mem::transmute(load);
            let thread = Handle(CreateRemoteThread(
                process.0,
                std::ptr::null(),
                0,
                Some(start),
                remote,
                0,
                std::ptr::null_mut(),
            ));
            if thread.0.is_null() {
                return Err(msg("Couldn't start loading the client in Minecraft."));
            }
            WaitForSingleObject(thread.0, 20_000);
            let mut code = 0u32;
            GetExitCodeThread(thread.0, &mut code);
            if code == 0 && !loaded(pid, &name) {
                return Err(msg(
                    "The client didn't load. It may not support this version of Minecraft yet.",
                ));
            }
            Ok(())
        })();
        VirtualFreeEx(process.0, remote, 0, MEM_RELEASE);
        result
    }
}

#[cfg(not(windows))]
mod win {
    use super::*;
    pub async fn launch(_dll: Option<PathBuf>) -> Result<String> {
        Err(msg(
            "Minecraft: Bedrock Edition is only available on Windows.",
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pe(machine: u16, characteristics: u16) -> Vec<u8> {
        let mut b = vec![0u8; 0x200];
        b[..2].copy_from_slice(b"MZ");
        b[0x3C..0x40].copy_from_slice(&0x80u32.to_le_bytes());
        b[0x80..0x84].copy_from_slice(b"PE\0\0");
        b[0x84..0x86].copy_from_slice(&machine.to_le_bytes());
        b[0x96..0x98].copy_from_slice(&characteristics.to_le_bytes());
        b
    }

    #[test]
    fn only_x64_dlls_pass() {
        assert!(is_x64_dll(&pe(0x8664, 0x2022)));
        assert!(!is_x64_dll(&pe(0x014C, 0x2102)), "32-bit");
        assert!(!is_x64_dll(&pe(0x8664, 0x0022)), "an exe, not a DLL");
        assert!(!is_x64_dll(b"not a dll"));
        assert!(!is_x64_dll(&[]));
    }
}
