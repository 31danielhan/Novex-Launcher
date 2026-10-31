import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";

export interface SystemInfo {
  appVersion: string;
  os: "windows" | "macos" | "linux" | string;
  arch: "x86_64" | "aarch64" | string;
  dataDir: string;
  devBuild: boolean;
}

let cached: Promise<SystemInfo | null> | null = null;

/** Returns null when running in a plain browser (`npm run dev` without Tauri). */
export function getSystemInfo(): Promise<SystemInfo | null> {
  if (!isTauri()) return Promise.resolve(null);
  cached ??= invoke<SystemInfo>("system_info");
  return cached;
}

export function useSystemInfo(): SystemInfo | null {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  useEffect(() => {
    getSystemInfo().then(setInfo).catch(() => setInfo(null));
  }, []);
  return info;
}

export const osLabel: Record<string, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};
