import { t } from "./i18n";
import { useApp } from "./store";
import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { api, errorText, inTauri, type Account, type AppUpdate, type Instance, type Source } from "./lib/api";

export type Status =
  | { state: "idle" }
  | { state: "launching"; stage: string; done: number; total: number }
  | { state: "running" };

export interface PackProgress {
  title: string;
  stage: string;
  done: number;
  total: number;
}

/** An update ready to apply: the app itself, or just the interface. */
export type Available =
  | { kind: "app"; update: AppUpdate }
  | { kind: "ui"; version: string };

/** An update worth telling the player about. `instance` opens that instance's page. */
export interface Alert {
  key: string;
  text: string;
  action?: { label: string; run: "update" } | { label: string; instance: string };
}

const MAX_LOG_LINES = 5000;
const SEEN_VERSION_KEY = "novex.seenVersion";
const SELECTED_KEY = "novex.selectedInstance";

function readSelected(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}
const IDLE: Status = { state: "idle" };

interface LauncherState {
  instances: Instance[];
  accounts: Account[];
  activeAccount: string | null;
  offlineAllowed: boolean;
  status: Record<string, Status>;
  logs: Record<string, string[]>;
  error: string | null;
  alerts: Alert[];
  dismissAlert: (key: string) => void;
  checkContentUpdates: () => Promise<void>;
  /** Success messages, shown like errors but not in red. */
  notice: string | null;
  /** The modpack being installed, if any. */
  pack: PackProgress | null;
  /** Instance shown on Home; may name a deleted instance, so read it via `selectedInstance`. */
  selected: string | null;
  /** Instance that Browse installs into. */
  browseTarget: string | null;
  /** Instance whose page is open on the Instances screen. */
  contentFor: string | null;
  available: Available | null;
  /** Bytes downloaded while an update installs; `null` when idle. */
  updating: { downloaded: number; total: number | null } | null;
  accountsOpen: boolean;
  newInstanceOpen: boolean;
  logsFor: string | null;

  refresh: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  launch: (id: string) => Promise<void>;
  kill: (id: string) => Promise<void>;
  installModpack: (source: Source, projectId: string, versionId: string | null, title: string) => Promise<boolean>;
  importModpack: () => Promise<void>;
  checkForUpdates: (manual?: boolean) => Promise<void>;
  applyUpdate: () => Promise<void>;
  setError: (e: string | null) => void;
  setNotice: (n: string | null) => void;
  setBrowseTarget: (id: string | null) => void;
  select: (id: string) => void;
  openContent: (id: string | null) => void;
  openAccounts: (open: boolean) => void;
  openNewInstance: (open: boolean) => void;
  openLogs: (id: string | null) => void;
}

export const useLauncher = create<LauncherState>((set, get) => ({
  instances: [],
  accounts: [],
  activeAccount: null,
  offlineAllowed: false,
  status: {},
  logs: {},
  error: null,
  alerts: [],
  dismissAlert: (key) => {
    dismissed.add(key);
    set((s) => ({ alerts: s.alerts.filter((a) => a.key !== key) }));
  },
  checkContentUpdates: async () => {
    for (const inst of get().instances) {
      const [content, client] = await Promise.all([
        api.contentUpdates(inst.id).catch(() => []),
        api.clientStatus(inst.id).catch(() => null),
      ]);
      const count = content.length + (client?.outdated ? 1 : 0);
      // Keyed by what's new, so a dismissed alert returns only when more updates appear.
      const key = `content/${inst.id}/${content.map((u) => u.versionId).sort().join()}/${!!client?.outdated}`;
      const text = t(count === 1 ? "1 update for {name}." : "{count} updates for {name}.", { count, name: inst.name });
      set((s) => {
        const others = s.alerts.filter((a) => !a.key.startsWith(`content/${inst.id}/`));
        return {
          alerts:
            count && !dismissed.has(key)
              ? [...others, { key, text, action: { label: t("View"), instance: inst.id } }]
              : others,
        };
      });
    }
  },
  notice: null,
  pack: null,
  selected: readSelected(),
  browseTarget: null,
  contentFor: null,
  available: null,
  updating: null,
  accountsOpen: false,
  newInstanceOpen: false,
  logsFor: null,

  refresh: async () => {
    if (!inTauri) return;
    try {
      set({ instances: await api.instances() });
    } catch (e) {
      set({ error: errorText(e) });
    }
  },

  refreshAccounts: async () => {
    if (!inTauri) return;
    try {
      const v = await api.accounts();
      set({ accounts: v.accounts, activeAccount: v.active, offlineAllowed: v.offlineAllowed });
    } catch (e) {
      set({ error: errorText(e) });
    }
  },

  launch: async (id) => {
    if (!get().activeAccount) {
      set({ accountsOpen: true });
      return;
    }
    set((s) => ({
      status: { ...s.status, [id]: { state: "launching", stage: "Starting", done: 0, total: 0 } },
      logs: { ...s.logs, [id]: [] },
      // Show the instance's live page while it starts.
      contentFor: id,
    }));
    useApp.getState().setScreen("instances");
    try {
      await api.launch(id);
      set((s) => ({ status: { ...s.status, [id]: { state: "running" } } }));
      get().refresh();
    } catch (e) {
      set((s) => ({ status: { ...s.status, [id]: IDLE }, error: errorText(e) }));
    }
  },

  kill: async (id) => {
    try {
      await api.kill(id);
    } catch (e) {
      set({ error: errorText(e) });
    }
  },

  installModpack: async (source, projectId, versionId, title) => {
    if (get().pack) {
      set({ error: t("Wait for the current modpack to finish installing.") });
      return false;
    }
    set({ pack: { title, stage: "Starting", done: 0, total: 0 } });
    try {
      finishPack(await api.installModpack(source, projectId, versionId, title));
      return true;
    } catch (e) {
      set({ error: errorText(e) });
      return false;
    } finally {
      set({ pack: null });
      get().refresh();
    }
  },

  importModpack: async () => {
    if (get().pack) {
      set({ error: t("Wait for the current modpack to finish installing.") });
      return;
    }
    const path = await open({
      title: t("Import a modpack"),
      filters: [{ name: t("Modpacks"), extensions: ["mrpack", "zip"] }],
    });
    if (typeof path !== "string") return;
    set({ pack: { title: path.split(/[\\/]/).pop() ?? t("Modpack"), stage: "Starting", done: 0, total: 0 } });
    try {
      finishPack(await api.importModpack(path));
    } catch (e) {
      set({ error: errorText(e) });
    } finally {
      set({ pack: null });
      get().refresh();
    }
  },

  checkForUpdates: async (manual = false) => {
    try {
      // A new app release beats an interface-only update.
      const app = await api.checkAppUpdate();
      if (app) {
        set({ available: { kind: "app", update: app } });
        return notifyUpdate(t("Novex {version} is available.", { version: app.version }), `app/${app.version}`);
      }
      const ui = await api.checkUiUpdate().catch((e) => {
        // A missing interface channel is normal; only report it when asked.
        if (manual) throw e;
        return null;
      });
      set({ available: ui ? { kind: "ui", version: ui.version } : null });
      if (ui) notifyUpdate(t("A new interface ({version}) is available.", { version: ui.version }), `ui/${ui.version}`);
      if (manual && !ui) set({ notice: t("Novex is up to date.") });
    } catch (e) {
      if (manual) set({ error: errorText(e) });
    }
  },

  applyUpdate: async () => {
    const a = get().available;
    if (!a || get().updating) return;
    set({ updating: { downloaded: 0, total: null } });
    try {
      if (a.kind === "app") {
        // Restarts the app when done.
        await api.installAppUpdate();
      } else {
        await api.installUiUpdate();
        window.location.reload();
      }
    } catch (e) {
      set({ error: errorText(e), updating: null });
    }
  },

  setError: (error) => set({ error }),
  setNotice: (notice) => set({ notice }),
  setBrowseTarget: (browseTarget) => set({ browseTarget }),
  select: (selected) => {
    try {
      localStorage.setItem(SELECTED_KEY, selected);
    } catch {
      // Non-fatal: Home just falls back to the last played instance.
    }
    set({ selected });
  },
  openContent: (contentFor) => set({ contentFor }),
  openAccounts: (accountsOpen) => set({ accountsOpen }),
  openNewInstance: (newInstanceOpen) => set({ newInstanceOpen }),
  openLogs: (logsFor) => set({ logsFor }),
}));

const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;
const dismissed = new Set<string>();

function notifyUpdate(text: string, key: string) {
  if (dismissed.has(key)) return;
  useLauncher.setState((s) => ({
    alerts: [
      ...s.alerts.filter((a) => a.key.startsWith("content/")),
      { key, text, action: { label: t("Update"), run: "update" } },
    ],
  }));
}

/** Says so once after the launcher or its interface changed version. */
async function announceUpdated() {
  const info = await api.updateInfo().catch(() => null);
  if (!info) return;
  const version = info.uiVersion ?? info.appVersion;
  try {
    const seen = localStorage.getItem(SEEN_VERSION_KEY);
    localStorage.setItem(SEEN_VERSION_KEY, version);
    if (seen && seen !== version) useLauncher.setState({ notice: t("Novex updated to {version}.", { version }) });
  } catch {
    // Storage can be unavailable; the message just doesn't show.
  }
}

/** Installs any update when the launcher opens, unless a game is already running. */
async function installAtStartup() {
  const { checkForUpdates, applyUpdate } = useLauncher.getState();
  await checkForUpdates();
  const { available, status, pack } = useLauncher.getState();
  const busy = pack !== null || Object.values(status).some((s) => s.state === "running" || s.state === "launching");
  if (available && !busy) await applyUpdate();
}

function finishPack({ instance, skipped }: { instance: Instance; skipped: string[] }) {
  useLauncher.setState({
    notice: skipped.length
      ? t("{name} is installed, but {count} file(s) must be downloaded by hand from CurseForge: {files}.", {
          name: instance.name,
          count: skipped.length,
          files: skipped.join(", "),
        })
      : t("{name} is installed and ready to play.", { name: instance.name }),
  });
}

/** The instance Home shows: the chosen one, else the most recently played. */
export const selectedInstance = (s: Pick<LauncherState, "instances" | "selected">): Instance | undefined =>
  s.instances.find((i) => i.id === s.selected) ?? s.instances[0];

export const statusOf = (s: Record<string, Status>, id: string): Status => s[id] ?? IDLE;

let started = false;

/** Loads initial data and subscribes to backend events. Safe to call more than once. */
export async function initLauncher() {
  if (started || !inTauri) return;
  started = true;
  const { refresh, refreshAccounts } = useLauncher.getState();

  await listen<{ instanceId: string; stage: string; done: number; total: number }>(
    "launch-progress",
    ({ payload: p }) =>
      useLauncher.setState((s) => ({
        status: {
          ...s.status,
          [p.instanceId]: { state: "launching", stage: p.stage, done: p.done, total: p.total },
        },
      })),
  );

  await listen<{ downloaded: number; total: number | null }>("app-update-progress", ({ payload }) =>
    useLauncher.setState({ updating: payload }),
  );

  await listen<PackProgress>("modpack-progress", ({ payload }) =>
    useLauncher.setState({ pack: payload }),
  );

  await listen<{ instanceId: string; line: string }>("game-log", ({ payload: p }) =>
    useLauncher.setState((s) => {
      const lines = (s.logs[p.instanceId] ?? []).concat(p.line.split("\n"));
      return {
        logs: { ...s.logs, [p.instanceId]: lines.slice(-MAX_LOG_LINES) },
      };
    }),
  );

  await listen<{ instanceId: string; code: number | null }>("game-exited", ({ payload: p }) => {
    useLauncher.setState((s) => ({
      status: { ...s.status, [p.instanceId]: IDLE },
      // A non-zero exit right after launch usually means a crash.
      error:
        p.code !== null && p.code !== 0
          ? t("Minecraft closed with exit code {code}. Open the logs to see why.", { code: p.code })
          : s.error,
    }));
    refresh();
  });

  // Tells the backend this interface started fine, so a downloaded one is kept.
  api.uiBootOk().catch(() => {});

  await Promise.all([refresh(), refreshAccounts()]);
  const running = await api.running().catch(() => [] as string[]);
  useLauncher.setState((s) => ({
    status: {
      ...s.status,
      ...Object.fromEntries(running.map((id) => [id, { state: "running" } as Status])),
    },
  }));

  const settings = await api.settings().catch(() => null);
  void announceUpdated();
  const { checkForUpdates, checkContentUpdates } = useLauncher.getState();
  if (settings?.autoUpdate) void installAtStartup();
  else void checkForUpdates();
  void checkContentUpdates();
  // For a launcher left open: this only notifies, so it never restarts mid-use.
  setInterval(() => {
    void checkForUpdates();
    void checkContentUpdates();
  }, UPDATE_CHECK_MS);
}
