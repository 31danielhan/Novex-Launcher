//! Live numbers for a running game: memory and CPU of the Java process, and how busy the GPU is.
//! The GPU figure is for the whole system, since no platform reports it per process without
//! vendor tools.

use std::collections::HashMap;
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use tauri::State;

use crate::error::Result;
use crate::AppState;

/// A started game process.
#[derive(Debug, Clone, Copy)]
pub struct Session {
    pub pid: u32,
    /// Unix seconds.
    pub started_at: u64,
    /// The -Xmx the game was given.
    pub max_memory_mb: u32,
}

#[derive(Default)]
pub struct Monitor {
    sessions: Mutex<HashMap<String, Session>>,
    system: Mutex<Option<System>>,
    gpu: Mutex<Option<(Instant, Option<f32>)>>,
}

impl Monitor {
    pub fn start(&self, id: &str, session: Session) {
        self.sessions
            .lock()
            .unwrap()
            .insert(id.to_string(), session);
    }

    pub fn end(&self, id: &str) {
        self.sessions.lock().unwrap().remove(id);
    }

    fn session(&self, id: &str) -> Option<Session> {
        self.sessions.lock().unwrap().get(id).copied()
    }

    /// Memory and CPU of one process. CPU is a share of the whole machine (0-100), measured since
    /// the previous call, so the first reading after launch is 0.
    fn process(&self, pid: u32) -> Option<(u64, f32)> {
        let mut guard = self.system.lock().unwrap();
        let sys = guard.get_or_insert_with(|| {
            let mut s = System::new();
            s.refresh_cpu_all();
            s
        });
        let pid = Pid::from_u32(pid);
        sys.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[pid]),
            true,
            ProcessRefreshKind::nothing().with_cpu().with_memory(),
        );
        let cores = sys.cpus().len().max(1) as f32;
        sys.process(pid)
            .map(|p| (p.memory(), p.cpu_usage() / cores))
    }

    /// System GPU use, cached for a second so polling doesn't spawn a process every time.
    fn gpu(&self) -> Option<f32> {
        let mut cache = self.gpu.lock().unwrap();
        if let Some((at, v)) = *cache {
            if at.elapsed() < Duration::from_secs(1) {
                return v;
            }
        }
        let v = read_gpu();
        *cache = Some((Instant::now(), v));
        v
    }
}

fn output(cmd: &str, args: &[&str]) -> Option<String> {
    let out = Command::new(cmd).args(args).output().ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

/// macOS: the GPU driver's own utilization statistic.
#[cfg(target_os = "macos")]
fn read_gpu() -> Option<f32> {
    let text = output(
        "ioreg",
        &["-r", "-d", "1", "-w", "0", "-c", "IOAccelerator"],
    )?;
    let key = "\"Device Utilization %\"=";
    let start = text.find(key)? + key.len();
    let digits: String = text[start..]
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect();
    digits.parse().ok()
}

/// Linux: AMD and Intel expose it in sysfs; otherwise ask nvidia-smi.
#[cfg(target_os = "linux")]
fn read_gpu() -> Option<f32> {
    for entry in std::fs::read_dir("/sys/class/drm").ok()?.flatten() {
        if let Ok(v) = std::fs::read_to_string(entry.path().join("device/gpu_busy_percent")) {
            if let Ok(v) = v.trim().parse() {
                return Some(v);
            }
        }
    }
    nvidia_smi()
}

/// Windows: nvidia-smi when an NVIDIA card is present; other vendors aren't covered.
#[cfg(target_os = "windows")]
fn read_gpu() -> Option<f32> {
    nvidia_smi()
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn read_gpu() -> Option<f32> {
    None
}

#[cfg(any(target_os = "linux", target_os = "windows"))]
fn nvidia_smi() -> Option<f32> {
    let text = output(
        "nvidia-smi",
        &[
            "--query-gpu=utilization.gpu",
            "--format=csv,noheader,nounits",
        ],
    )?;
    text.lines().next()?.trim().parse().ok()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstanceStats {
    pub started_at: u64,
    pub memory_mb: u64,
    pub max_memory_mb: u32,
    pub cpu: f32,
    /// None where the platform doesn't report it.
    pub gpu: Option<f32>,
}

/// Numbers for a running instance, or None once it has exited.
#[tauri::command]
pub async fn instance_stats(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<InstanceStats>> {
    let Some(session) = state.monitor.session(&id) else {
        return Ok(None);
    };
    let (memory, cpu) = state.monitor.process(session.pid).unwrap_or((0, 0.0));
    let gpu = state.monitor.gpu();
    Ok(Some(InstanceStats {
        started_at: session.started_at,
        memory_mb: memory / (1024 * 1024),
        max_memory_mb: session.max_memory_mb,
        cpu,
        gpu,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_own_process() {
        let m = Monitor::default();
        let (memory, cpu) = m
            .process(std::process::id())
            .expect("own process is visible");
        assert!(memory > 0);
        assert!((0.0..=100.0).contains(&cpu));
        assert!(m.process(u32::MAX - 1).is_none());
    }

    #[test]
    fn gpu_reading_is_a_percentage_when_present() {
        if let Some(v) = Monitor::default().gpu() {
            assert!((0.0..=100.0).contains(&v), "{v}");
        }
    }
}
