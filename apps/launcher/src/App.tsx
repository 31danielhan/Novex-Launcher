import { useEffect } from "react";
import { X } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { AccountsDialog } from "./components/AccountsDialog";
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

const screens: Record<Screen, () => JSX.Element> = {
  home: HomeScreen,
  instances: InstancesScreen,
  browse: BrowseScreen,
  client: ClientScreen,
  settings: SettingsScreen,
};

function StatusBar() {
  const { status, instances, error, setError } = useLauncher();
  const launching = Object.entries(status).find(([, s]) => s.state === "launching");
  const name = launching && instances.find((i) => i.id === launching[0])?.name;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex max-w-sm flex-col items-end gap-2">
      {error && (
        <div className="hairline pointer-events-auto flex animate-[fade_150ms_ease-out] items-start gap-3 rounded-lg border bg-surface px-4 py-3 shadow-xl">
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
      <main className="flex-1 overflow-y-auto">
        <div key={screen} className="mx-auto max-w-5xl animate-[fade_180ms_ease-out] px-8 py-8">
          <Current />
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
