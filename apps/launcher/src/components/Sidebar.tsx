import { t } from "../i18n";
import {
  Blocks,
  Boxes,
  Compass,
  Gamepad2,
  LayoutGrid,
  Settings,
  Swords,
  type LucideIcon,
} from "lucide-react";
import logo from "../assets/logo.svg";
import { useApp, type Screen } from "../store";
import { statusOf, useLauncher } from "../launcher";
import { gamePhase, type Phase } from "../lib/phase";
import { cx } from "./ui";

const items: { id: Screen; label: string; icon: LucideIcon; beta?: boolean }[] = [
  { id: "home", label: "Home", icon: LayoutGrid },
  { id: "instances", label: "Instances", icon: Boxes },
  { id: "browse", label: "Browse", icon: Compass },
  { id: "client", label: "Novex Client", icon: Swords },
  { id: "bedrock", label: "Bedrock", icon: Blocks, beta: true },
  { id: "game", label: "Game settings", icon: Gamepad2 },
  { id: "settings", label: "Settings", icon: Settings },
];

function NavButton({ id, label, icon: Icon, beta }: { id: Screen; label: string; icon: LucideIcon; beta?: boolean }) {
  const { screen, setScreen } = useApp();
  const openContent = useLauncher((s) => s.openContent);
  const active = screen === id;
  return (
    <button
      onClick={() => {
        // The Instances button always leads back to the list, not an open instance page.
        if (id === "instances") openContent(null);
        setScreen(id);
      }}
      aria-current={active ? "page" : undefined}
      className={cx(
        "nudge relative flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition",
        active
          ? "glass shadow-card bg-surface text-fg before:absolute before:inset-y-2 before:-left-3 before:w-[3px] before:rounded-r before:bg-accent"
          : "text-muted hover:bg-fg/[0.05] hover:text-fg",
      )}
    >
      <Icon size={16} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-accent" : undefined} />
      {t(label)}
      {beta && (
        <span className="ml-auto rounded-full bg-accent/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-accent">
          {t("Beta")}
        </span>
      )}
    </button>
  );
}

/** Instances that are starting or running, listed under Instances; each opens its live page. */
function ActiveInstances() {
  const { instances, status, logs, contentFor, openContent } = useLauncher();
  const { screen, setScreen } = useApp();
  const active = instances.filter((i) => statusOf(status, i.id).state !== "idle");
  if (!active.length) return null;
  return (
    <div className="ml-[22px] mt-1 flex animate-[rise_220ms_cubic-bezier(0.2,0.8,0.2,1)] flex-col gap-0.5 border-l border-fg/10 pl-2">
      {active.map((inst) => {
        const phase = gamePhase(statusOf(status, inst.id), logs[inst.id]);
        const busy = phase === "saving" || phase === "closing" || phase === "preparing" || phase === "loading";
        const current = screen === "instances" && contentFor === inst.id;
        return (
          <button
            key={inst.id}
            onClick={() => {
              openContent(inst.id);
              setScreen("instances");
            }}
            aria-current={current ? "page" : undefined}
            className={cx(
              "nudge flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[12px] transition",
              current ? "bg-surface font-medium text-fg shadow-card" : "text-muted hover:bg-fg/[0.05] hover:text-fg",
            )}
          >
            <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", busy ? "animate-pulse bg-amber-500" : "bg-success")} />
            <span className="min-w-0 flex-1 truncate">{inst.name}</span>
            {phase && <span className="shrink-0 text-[10px] text-muted">{t(phaseShort[phase])}</span>}
          </button>
        );
      })}
    </div>
  );
}

const phaseShort: Record<Phase, string> = {
  preparing: "Starting",
  loading: "Loading",
  menu: "Menu",
  joining: "Joining",
  playing: "Playing",
  saving: "Saving",
  closing: "Closing",
};

export function Sidebar() {
  return (
    <nav data-tauri-drag-region className="titlebar-inset flex w-56 shrink-0 flex-col px-3 pb-4 pt-5">
      <div data-tauri-drag-region className="mb-6 flex items-center gap-2.5 px-2">
        <img src={logo} alt="" draggable={false} className="pointer-events-none h-8 w-8" />
        <span className="display pointer-events-none text-[19px] font-bold">Novex</span>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((i) => (
          <div key={i.id}>
            <NavButton {...i} />
            {i.id === "instances" && <ActiveInstances />}
          </div>
        ))}
      </div>
    </nav>
  );
}
