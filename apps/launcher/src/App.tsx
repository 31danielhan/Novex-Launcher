import { useEffect } from "react";
import { ArrowUpCircle, CheckCircle2, Loader2, Plus, Search, UserRound, X } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { AccountsDialog, Avatar } from "./components/AccountsDialog";
import { NewInstanceDialog } from "./components/NewInstanceDialog";
import { LogsDialog } from "./components/LogsDialog";
import { ContentDialog } from "./components/ContentDialog";
import { InstanceSettingsDialog } from "./components/InstanceSettingsDialog";
import { progressLabel } from "./components/InstanceCard";
import { useApp, type Screen } from "./store";
import { initLauncher, useLauncher } from "./launcher";
import { HomeScreen } from "./screens/Home";
import { InstancesScreen } from "./screens/Instances";
import { BrowseScreen } from "./screens/Browse";
import { ClientScreen } from "./screens/Client";
import { SettingsScreen } from "./screens/Settings";

const titles: Record<Screen, string> = {
  home: "Home",
  instances: "Instances",
  browse: "Browse",
  client: "Novex Client",
  settings: "Settings",
};

const screens: Record<Screen, () => JSX.Element> = {
  home: HomeScreen,
  instances: InstancesScreen,
  browse: BrowseScreen,
  client: ClientScreen,
  settings: SettingsScreen,
};

function TopBar({ title }: { title: string }) {
  const setScreen = useApp((s) => s.setScreen);
  const { accounts, activeAccount, openAccounts, openNewInstance } = useLauncher();
  const name = accounts.find((a) => a.uuid === activeAccount)?.name;

  return (
    <header className="flex items-center gap-3 px-6 pb-4 pt-5">
      <h1 className="flex-1 text-[22px] font-semibold tracking-tight">{title}</h1>
      <UpdateButton />
      <button
        onClick={() => setScreen("browse")}
        className="hairline shadow-card flex h-10 w-64 items-center gap-2 rounded-full border bg-surface px-4 text-[13px] text-muted transition hover:text-fg"
      >
        <Search size={15} />
        Search mods and modpacks…
      </button>
      <button
        onClick={() => openNewInstance(true)}
        className="flex h-10 items-center gap-1.5 rounded-full bg-accent px-5 text-[13px] font-medium text-accent-fg shadow-sm transition hover:opacity-90"
      >
        <Plus size={15} />
        Create
      </button>
      <button
        onClick={() => openAccounts(true)}
        aria-label={name ?? "Sign in"}
        title={name ?? "Sign in"}
        className="hairline shadow-card grid h-10 w-10 place-items-center rounded-full border bg-surface text-muted transition hover:text-fg"
      >
        {name ? <Avatar name={name} size={32} /> : <UserRound size={17} />}
      </button>
    </header>
  );
}

function UpdateButton() {
  const { available, updating, applyUpdate } = useLauncher();
  if (!available) return null;
  const label =
    available.kind === "app" ? `Update to ${available.update.version}` : `New interface ${available.version}`;
  const pct =
    updating?.total ? Math.round((updating.downloaded / updating.total) * 100) : null;
  return (
    <button
      onClick={applyUpdate}
      disabled={!!updating}
      title={
        available.kind === "app"
          ? "Downloads the update, then restarts Novex"
          : "Downloads the new interface and reloads it"
      }
      className="flex h-10 items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-4 text-[13px] font-medium text-success transition hover:bg-success/15 disabled:cursor-wait"
    >
      {updating ? <Loader2 size={15} className="animate-spin" /> : <ArrowUpCircle size={15} />}
      {updating ? `Updating${pct !== null ? ` ${pct}%` : "…"}` : label}
    </button>
  );
}

function StatusBar() {
  const { status, instances, error, setError, notice, setNotice, pack } = useLauncher();
  const launching = Object.entries(status).find(([, s]) => s.state === "launching");
  const name = launching && instances.find((i) => i.id === launching[0])?.name;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex max-w-sm flex-col items-end gap-2">
      {error && (
        <div className="hairline pointer-events-auto flex animate-[fade_150ms_ease-out] items-start gap-3 rounded-xl border bg-surface px-4 py-3 shadow-xl">
          <p className="select-text text-[13px] text-danger">{error}</p>
          <button
            aria-label="Dismiss"
            onClick={() => setError(null)}
            className="text-muted hover:text-fg"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {notice && (
        <div className="hairline pointer-events-auto flex animate-[fade_150ms_ease-out] items-start gap-3 rounded-xl border bg-surface px-4 py-3 shadow-xl">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
          <p className="select-text text-[13px]">{notice}</p>
          <button aria-label="Dismiss" onClick={() => setNotice(null)} className="text-muted hover:text-fg">
            <X size={14} />
          </button>
        </div>
      )}
      {pack && (
        <div className="hairline w-72 rounded-xl border bg-surface px-4 py-3 shadow-xl">
          <div className="flex items-center gap-2 text-[12px]">
            <Loader2 size={14} className="shrink-0 animate-spin text-muted" />
            <span className="truncate font-medium">{pack.title}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-fg/10">
            <div
              className={pack.total ? "h-full rounded-full bg-success transition-all" : "h-full w-1/3 animate-pulse rounded-full bg-success"}
              style={pack.total ? { width: `${(pack.done / pack.total) * 100}%` } : undefined}
            />
          </div>
          <p className="mt-1.5 truncate text-[11px] text-muted">
            {pack.stage}
            {pack.total > 0 && ` · ${pack.done}/${pack.total}`}
          </p>
        </div>
      )}
      {launching && (
        <div className="hairline rounded-full border bg-surface px-4 py-2 text-[12px] shadow-lg">
          <span className="font-medium">{name}</span>
          <span className="text-muted"> · {progressLabel(launching[1])}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const screen = useApp((s) => s.screen);
  const Current = screens[screen];

  useEffect(() => {
    initLauncher();
  }, []);

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar title={titles[screen]} />
        <div className="flex-1 overflow-y-auto">
          <div key={screen} className="mx-auto max-w-6xl animate-[fade_180ms_ease-out] px-6 pb-8">
            <Current />
          </div>
        </div>
      </main>
      <StatusBar />
      <AccountsDialog />
      <NewInstanceDialog />
      <LogsDialog />
      <ContentDialog />
      <InstanceSettingsDialog />
    </div>
  );
}
