import {
  Boxes,
  Compass,
  LayoutGrid,
  Moon,
  Settings,
  Sun,
  Swords,
  type LucideIcon,
} from "lucide-react";
import logo from "../assets/logo.svg";
import { useApp, type Screen } from "../store";
import { cx } from "./ui";

const items: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: LayoutGrid },
  { id: "instances", label: "Instances", icon: Boxes },
  { id: "browse", label: "Browse", icon: Compass },
  { id: "client", label: "Novex Client", icon: Swords },
  { id: "settings", label: "Settings", icon: Settings },
];

function NavButton({ id, label, icon: Icon }: { id: Screen; label: string; icon: LucideIcon }) {
  const { screen, setScreen } = useApp();
  const active = screen === id;
  return (
    <button
      onClick={() => setScreen(id)}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-10 w-full items-center gap-3 rounded-full px-3.5 text-[13px] font-medium transition",
        active ? "shadow-card bg-surface text-fg" : "text-muted hover:bg-fg/[0.04] hover:text-fg",
      )}
    >
      <Icon size={17} strokeWidth={active ? 2.1 : 1.8} />
      {label}
    </button>
  );
}

/** Promo card for the PvP client, like the upgrade card in the sidebar of dashboard apps. */
function ClientCard() {
  const setScreen = useApp((s) => s.setScreen);
  return (
    <div className="hairline shadow-card overflow-hidden rounded-xl border bg-surface">
      <div className="grid h-20 place-items-center bg-gradient-to-br from-violet-300 via-violet-200 to-sky-200 text-violet-900/70 dark:from-violet-500/40 dark:via-violet-400/20 dark:to-sky-400/20 dark:text-violet-100">
        <Swords size={28} strokeWidth={1.6} />
      </div>
      <div className="p-3.5">
        <p className="text-[13px] font-semibold">Play smoother with Novex Client</p>
        <p className="mt-1 text-[12px] leading-snug text-muted">FPS boost and PvP HUDs, one toggle away.</p>
        <button
          onClick={() => setScreen("client")}
          className="mt-3 h-8 w-full rounded-full bg-accent text-[12px] font-medium text-accent-fg transition hover:opacity-90"
        >
          Learn more
        </button>
      </div>
    </div>
  );
}

function ThemeSwitch() {
  // Subscribing to theme re-renders this when it changes; the resolved value is on <html>.
  useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const dark = document.documentElement.dataset.theme === "dark";
  const option = (value: "light" | "dark", Icon: LucideIcon, on: boolean) => (
    <button
      aria-label={`${value} theme`}
      aria-pressed={on}
      onClick={() => setTheme(value)}
      className={cx(
        "grid h-8 flex-1 place-items-center rounded-full transition",
        on ? "shadow-card bg-surface text-fg" : "text-muted hover:text-fg",
      )}
    >
      <Icon size={15} />
    </button>
  );
  return (
    <div className="mt-3 flex rounded-full bg-fg/[0.05] p-1">
      {option("light", Sun, !dark)}
      {option("dark", Moon, dark)}
    </div>
  );
}

export function Sidebar() {
  return (
    <nav data-tauri-drag-region className="titlebar-inset flex w-56 shrink-0 flex-col px-3 pb-4 pt-5">
      <div data-tauri-drag-region className="mb-6 flex items-center gap-2.5 px-2">
        <img src={logo} alt="" draggable={false} className="pointer-events-none h-8 w-8" />
        <span className="pointer-events-none text-[15px] font-semibold tracking-tight">Novex</span>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((i) => (
          <NavButton key={i.id} {...i} />
        ))}
      </div>
      <div className="flex-1" />
      <ClientCard />
      <ThemeSwitch />
    </nav>
  );
}
