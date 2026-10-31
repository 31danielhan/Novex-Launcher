import { useEffect } from "react";
import { Plus, Search, UserRound, X } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { AccountsDialog, Avatar } from "./components/AccountsDialog";
import { NewInstanceDialog } from "./components/NewInstanceDialog";
import { LogsDialog } from "./components/LogsDialog";
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

function StatusBar() {
  const { status, instances, error, setError } = useLauncher();
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
      <InstanceSettingsDialog />
    </div>
  );
}
