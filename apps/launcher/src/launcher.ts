import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { api, errorText, inTauri, type Account, type Instance, type Source } from "./lib/api";

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

const MAX_LOG_LINES = 5000;
const IDLE: Status = { state: "idle" };

interface LauncherState {
  instances: Instance[];
  accounts: Account[];
  activeAccount: string | null;
  status: Record<string, Status>;
  logs: Record<string, string[]>;
  error: string | null;
  /** Success messages, shown like errors but not in red. */
  notice: string | null;
  /** The modpack being installed, if any. */
  pack: PackProgress | null;
  /** Instance that Browse installs into. */
  browseTarget: string | null;
  contentFor: string | null;
  accountsOpen: boolean;
  newInstanceOpen: boolean;
  logsFor: string | null;
  settingsFor: string | null;

  refresh: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  launch: (id: string) => Promise<void>;
  kill: (id: string) => Promise<void>;
  installModpack: (source: Source, projectId: string, versionId: string | null, title: string) => Promise<boolean>;
  importModpack: () => Promise<void>;
  setError: (e: string | null) => void;
  setNotice: (n: string | null) => void;
  setBrowseTarget: (id: string | null) => void;
  openContent: (id: string | null) => void;
  openAccounts: (open: boolean) => void;
  openNewInstance: (open: boolean) => void;
  openLogs: (id: string | null) => void;
  openInstanceSettings: (id: string | null) => void;
}

export const useLauncher = create<LauncherState>((set, get) => ({
  instances: [],
  accounts: [],
  activeAccount: null,
  status: {},
  logs: {},
  error: null,
  notice: null,
  pack: null,
  browseTarget: null,
  contentFor: null,
  accountsOpen: false,
  newInstanceOpen: false,
  logsFor: null,
  settingsFor: null,

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
      set({ accounts: v.accounts, activeAccount: v.active });
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
    }));
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
      set({ error: "Wait for the current modpack to finish installing." });
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
      set({ error: "Wait for the current modpack to finish installing." });
      return;
    }
    const path = await open({
      title: "Import a modpack",
      filters: [{ name: "Modpacks", extensions: ["mrpack", "zip"] }],
    });
    if (typeof path !== "string") return;
    set({ pack: { title: path.split(/[\\/]/).pop() ?? "Modpack", stage: "Starting", done: 0, total: 0 } });
    try {
      finishPack(await api.importModpack(path));
    } catch (e) {
      set({ error: errorText(e) });
    } finally {
      set({ pack: null });
      get().refresh();
    }
  },

  setError: (error) => set({ error }),
  setNotice: (notice) => set({ notice }),
  setBrowseTarget: (browseTarget) => set({ browseTarget }),
  openContent: (contentFor) => set({ contentFor }),
  openAccounts: (accountsOpen) => set({ accountsOpen }),
  openNewInstance: (newInstanceOpen) => set({ newInstanceOpen }),
  openLogs: (logsFor) => set({ logsFor }),
  openInstanceSettings: (settingsFor) => set({ settingsFor }),
}));

function finishPack({ instance, skipped }: { instance: Instance; skipped: string[] }) {
  useLauncher.setState({
    notice: skipped.length
      ? `${instance.name} is installed, but ${skipped.length} file(s) must be downloaded by hand from CurseForge: ${skipped.join(", ")}.`
      : `${instance.name} is installed and ready to play.`,
  });
}

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
          ? `Minecraft closed with exit code ${p.code}. Open the logs to see why.`
          : s.error,
    }));
    refresh();
  });

  await Promise.all([refresh(), refreshAccounts()]);
  const running = await api.running().catch(() => [] as string[]);
  useLauncher.setState((s) => ({
    status: {
      ...s.status,
      ...Object.fromEntries(running.map((id) => [id, { state: "running" } as Status])),
    },
  }));
}
