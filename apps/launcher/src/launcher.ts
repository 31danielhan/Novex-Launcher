import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { api, errorText, inTauri, type Account, type Instance } from "./lib/api";

export type Status =
  | { state: "idle" }
  | { state: "launching"; stage: string; done: number; total: number }
  | { state: "running" };

const MAX_LOG_LINES = 5000;
const IDLE: Status = { state: "idle" };

interface LauncherState {
  instances: Instance[];
  accounts: Account[];
  activeAccount: string | null;
  status: Record<string, Status>;
  logs: Record<string, string[]>;
  error: string | null;
  accountsOpen: boolean;
  newInstanceOpen: boolean;
  logsFor: string | null;

  refresh: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  launch: (id: string) => Promise<void>;
  kill: (id: string) => Promise<void>;
  setError: (e: string | null) => void;
  openAccounts: (open: boolean) => void;
  openNewInstance: (open: boolean) => void;
  openLogs: (id: string | null) => void;
}

export const useLauncher = create<LauncherState>((set, get) => ({
  instances: [],
  accounts: [],
  activeAccount: null,
  status: {},
  logs: {},
  error: null,
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

  setError: (error) => set({ error }),
  openAccounts: (accountsOpen) => set({ accountsOpen }),
  openNewInstance: (newInstanceOpen) => set({ newInstanceOpen }),
  openLogs: (logsFor) => set({ logsFor }),
}));

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
