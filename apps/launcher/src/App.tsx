import { Sidebar } from "./components/Sidebar";
import { useApp, type Screen } from "./store";
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

export default function App() {
  const screen = useApp((s) => s.screen);
  const Current = screens[screen];
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div key={screen} className="mx-auto max-w-5xl animate-[fade_180ms_ease-out] px-8 py-8">
          <Current />
        </div>
      </main>
    </div>
  );
}
