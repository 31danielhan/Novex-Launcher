import { invoke, isTauri } from "@tauri-apps/api/core";

export interface Account {
  uuid: string;
  name: string;
  kind: "microsoft" | "offline";
}

export interface AccountsView {
  active: string | null;
  accounts: Account[];
  /** Offline accounts need a Microsoft account that owns the game first (except dev builds). */
  offlineAllowed: boolean;
}

export type LoaderKind = "vanilla" | "fabric" | "quilt" | "forge" | "neoforge";

export const loaderLabels: Record<LoaderKind, string> = {
  vanilla: "Vanilla",
  fabric: "Fabric",
  quilt: "Quilt",
  forge: "Forge",
  neoforge: "NeoForge",
};

export interface LoaderVersion {
  id: string;
  label: string;
  stable: boolean;
  recommended: boolean;
}

export interface Instance {
  id: string;
  name: string;
  version: string;
  loader: LoaderKind;
  loaderVersion?: string | null;
  created: number;
  lastPlayed?: number | null;
  playTimeSecs: number;
  memoryMb?: number | null;
  javaPath?: string | null;
  jvmArgs?: string | null;
  modpack?: ModpackRef | null;
}

export interface ModpackRef {
  source: Source | null;
  projectId: string | null;
  versionId: string | null;
  version: string;
  iconUrl: string | null;
}

export interface InstancePatch {
  name: string;
  loaderVersion: string | null;
  memoryMb: number | null;
  javaPath: string | null;
  jvmArgs: string | null;
}

/** "Fabric 0.20.1 · 26.3" or "Vanilla 26.3". */
export function describe(i: Instance): string {
  if (i.loader === "vanilla") return `Vanilla ${i.version}`;
  const lv = i.loaderVersion?.replace(`${i.version}-`, "") ?? "";
  return `${loaderLabels[i.loader]} ${lv} · ${i.version}`;
}

export interface VersionEntry {
  id: string;
  type: "release" | "snapshot" | "old_beta" | "old_alpha";
  releaseTime: string;
}

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export type Source = "modrinth" | "curseforge";
export type ContentKind = "modpack" | "mod" | "resourcepack" | "shader";

export interface SearchQuery {
  source: Source;
  kind: ContentKind;
  query: string;
  gameVersion: string | null;
  loader: LoaderKind | null;
  offset: number;
}

export interface SearchHit {
  source: Source;
  id: string;
  title: string;
  description: string;
  author: string;
  iconUrl: string | null;
  downloads: number;
  categories: string[];
  url: string;
}

export interface SearchPage {
  hits: SearchHit[];
  total: number;
}

export interface ContentVersion {
  id: string;
  name: string;
  versionNumber: string;
  gameVersions: string[];
  loaders: string[];
  published: string;
  channel: "release" | "beta" | "alpha";
  file: { url: string | null; filename: string; sha1: string | null; size: number | null };
}

export interface InstalledItem {
  kind: ContentKind;
  file: string;
  enabled: boolean;
  title: string;
  version: string | null;
  iconUrl: string | null;
  source: Source | null;
  projectId: string | null;
}

export interface ModpackInstalled {
  instance: Instance;
  skipped: string[];
}

export interface Settings {
  maxMemoryMb: number;
  javaPath: string | null;
  jvmArgs: string;
  autoUpdate: boolean;
}

export interface UpdateInfo {
  appVersion: string;
  configured: boolean;
  uiVersion: string | null;
}

export interface AppUpdate {
  version: string;
  currentVersion: string;
  notes: string | null;
}

export const inTauri = isTauri();

function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!inTauri) return Promise.reject(new Error("Available in the desktop app."));
  return invoke<T>(cmd, args);
}

export const api = {
  accounts: () => call<AccountsView>("accounts_list"),
  selectAccount: (uuid: string) => call<void>("account_select", { uuid }),
  removeAccount: (uuid: string) => call<void>("account_remove", { uuid }),
  addOffline: (name: string) => call<Account>("account_add_offline", { name }),
  authStart: () => call<DeviceCode>("auth_start"),
  authFinish: (c: DeviceCode) =>
    call<Account>("auth_finish", {
      deviceCode: c.deviceCode,
      interval: c.interval,
      expiresIn: c.expiresIn,
    }),
  authCancel: () => call<void>("auth_cancel"),

  versions: () => call<VersionEntry[]>("versions_list"),
  instances: () => call<Instance[]>("instances_list"),
  createInstance: (name: string, version: string, loader: LoaderKind, loaderVersion: string | null) =>
    call<Instance>("instance_create", { name, version, loader, loaderVersion }),
  updateInstance: (id: string, patch: InstancePatch) =>
    call<Instance>("instance_update", { id, patch }),
  cloneInstance: (id: string) => call<Instance>("instance_clone", { id }),
  loaderVersions: (kind: LoaderKind, game: string) =>
    call<LoaderVersion[]>("loader_versions", { kind, game }),
  deleteInstance: (id: string) => call<void>("instance_delete", { id }),
  instanceFolder: (id: string) => call<string>("instance_folder", { id }),
  openPath: (path: string) => call<void>("open_path", { path }),

  launch: (id: string) => call<void>("launch_instance", { id }),
  kill: (id: string) => call<void>("kill_instance", { id }),
  running: () => call<string[]>("running_instances"),

  contentSources: () => call<{ curseforge: boolean }>("content_sources"),
  search: (query: SearchQuery) => call<SearchPage>("content_search", { query }),
  contentVersions: (source: Source, projectId: string, kind: ContentKind, instanceId: string | null) =>
    call<ContentVersion[]>("content_versions", { source, projectId, kind, instanceId }),
  installContent: (
    instanceId: string,
    source: Source,
    projectId: string,
    kind: ContentKind,
    versionId: string | null,
  ) => call<string[]>("content_install", { instanceId, source, projectId, kind, versionId }),
  installedContent: (instanceId: string) => call<InstalledItem[]>("content_list", { instanceId }),
  setContentEnabled: (instanceId: string, kind: ContentKind, file: string, enabled: boolean) =>
    call<void>("content_set_enabled", { instanceId, kind, file, enabled }),
  removeContent: (instanceId: string, kind: ContentKind, file: string) =>
    call<void>("content_remove", { instanceId, kind, file }),
  installModpack: (source: Source, projectId: string, versionId: string | null, title: string) =>
    call<ModpackInstalled>("modpack_install", { source, projectId, versionId, title }),
  importModpack: (path: string) => call<ModpackInstalled>("modpack_import", { path }),

  updateInfo: () => call<UpdateInfo>("update_info"),
  checkAppUpdate: () => call<AppUpdate | null>("app_update_check"),
  installAppUpdate: () => call<void>("app_update_install"),
  checkUiUpdate: () => call<{ version: string } | null>("ui_update_check"),
  installUiUpdate: () => call<string>("ui_update_install"),
  uiBootOk: () => call<void>("ui_boot_ok"),
  uiReset: () => call<void>("ui_reset"),

  settings: () => call<Settings>("settings_get"),
  saveSettings: (settings: Settings) => call<Settings>("settings_set", { settings }),
};

export function errorText(e: unknown): string {
  return typeof e === "string" ? e : e instanceof Error ? e.message : String(e);
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function timeAgo(secs?: number | null): string {
  if (!secs) return "Never played";
  const d = Date.now() / 1000 - secs;
  if (d < 60) return "Just now";
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)} d ago`;
  return new Date(secs * 1000).toLocaleDateString();
}
