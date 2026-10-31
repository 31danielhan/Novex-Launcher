import { invoke, isTauri } from "@tauri-apps/api/core";

export interface SystemInfo {
  appVersion: string;
  os: "windows" | "macos" | "linux" | string;
  arch: "x86_64" | "aarch64" | string;
  dataDir: string;
}

/** Returns null when running in a plain browser (`npm run dev` without Tauri). */
export async function getSystemInfo(): Promise<SystemInfo | null> {
  if (!isTauri()) return null;
  return invoke<SystemInfo>("system_info");
}

export const osLabel: Record<string, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};
