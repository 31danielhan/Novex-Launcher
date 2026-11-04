import { t } from "../i18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Boxes,
  Camera,
  Check,
  ChevronDown,
  Clock,
  Copy,
  FolderOpen,
  Globe,
  Maximize2,
  Package,
  Palette,
  Plus,
} from "lucide-react";
import { useApp } from "../store";
import { selectedInstance, statusOf, useLauncher } from "../launcher";
import { api, describe, errorText, timeAgo, type Instance, type InstanceFolder } from "../lib/api";
import { Badge, Button, Card, cx } from "../components/ui";
import { InstanceIcon, PlayButton, ProgressBar } from "../components/InstanceCard";
import { lineClass } from "../components/LogsDialog";

export function playTime(secs: number) {
  const h = secs / 3600;
  if (h >= 10) return `${Math.round(h)}h`;
  if (h >= 1) return `${h.toFixed(1).replace(/\.0$/, "")}h`;
  return `${Math.round(secs / 60)}m`;
}

/** Picks which instance Home shows and plays. */
export function InstanceSwitcher({ current }: { current: Instance }) {
  const { instances, status, select, openNewInstance } = useLauncher();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 rounded-md px-2 py-1 -ml-2 text-[13px] font-medium text-muted transition hover:bg-fg/5 hover:text-fg"
      >
        {t("Switch instance")}
        <ChevronDown size={14} className={cx("transition", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="listbox"
          className="hairline absolute left-0 top-full z-30 mt-2 max-h-80 w-80 animate-[fade_120ms_ease-out] overflow-y-auto rounded-xl border bg-surface/95 p-1.5 shadow-2xl"
        >
          {instances.map((i) => {
            const s = statusOf(status, i.id).state;
            const on = i.id === current.id;
            return (
              <button
                key={i.id}
                role="option"
                aria-selected={on}
                onClick={() => {
                  select(i.id);
                  setOpen(false);
                }}
                className={cx(
                  "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition",
                  on ? "bg-fg/[0.06]" : "hover:bg-fg/[0.04]",
                )}
              >
                <InstanceIcon inst={i} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{i.name}</span>
                  <span className="block truncate text-[11px] text-muted">{describe(i)}</span>
                </span>
                {s === "running" ? (
                  <Badge tone="success">{t("Running")}</Badge>
                ) : (
                  on && <Check size={15} className="text-muted" />
                )}
              </button>
            );
          })}
          <button
            onClick={() => {
              setOpen(false);
              openNewInstance(true);
            }}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[13px] text-muted transition hover:bg-fg/[0.04] hover:text-fg"
          >
            <span className="grid h-[34px] w-[34px] place-items-center rounded-lg border border-dashed border-fg/20">
              <Plus size={15} />
            </span>
            {t("New instance")}
          </button>
        </div>
      )}
    </div>
  );
}

export function FolderButton({
  inst,
  sub,
  icon: Icon,
  children,
}: {
  inst: Instance;
  sub?: InstanceFolder;
  icon: typeof FolderOpen;
  children: ReactNode;
}) {
  const setError = useLauncher((s) => s.setError);
  const open = async () => {
    try {
      await api.openPath(await api.instanceFolder(inst.id, sub));
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <Button icon={Icon} onClick={open} className="h-8 px-3 text-[12px]">
      {children}
    </Button>
  );
}

function Hero({ inst }: { inst: Instance }) {
  const status = useLauncher((s) => s.status);
  const openContent = useLauncher((s) => s.openContent);
  const setScreen = useApp((s) => s.setScreen);

  return (
    // Raised above the log card, so the switcher's menu isn't covered by its glass layer.
    <Card className="relative z-10 p-5">
      <InstanceSwitcher current={inst} />
      <div className="mt-3 flex items-center gap-4">
        <InstanceIcon inst={inst} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-muted">
            {inst.lastPlayed ? t("Last played {time}", { time: timeAgo(inst.lastPlayed) }) : t("Ready to play")}
          </p>
          <p className="display truncate text-[26px] font-bold leading-tight">{inst.name}</p>
          <p className="truncate text-[12px] text-muted">{describe(inst)}</p>
        </div>
        <PlayButton inst={inst} large />
      </div>
      <ProgressBar s={statusOf(status, inst.id)} />
      <div className="mt-5 flex flex-wrap gap-2">
        <FolderButton inst={inst} sub="resourcepacks" icon={Palette}>
          {t("Resource packs")}
        </FolderButton>
        {inst.loader !== "vanilla" && (
          <FolderButton inst={inst} sub="mods" icon={Package}>
            {t("Mods")}
          </FolderButton>
        )}
        <FolderButton inst={inst} sub="saves" icon={Globe}>
          {t("Worlds")}
        </FolderButton>
        <FolderButton inst={inst} sub="screenshots" icon={Camera}>
          {t("Screenshots")}
        </FolderButton>
        <FolderButton inst={inst} icon={FolderOpen}>
          {t("Instance folder")}
        </FolderButton>
        <div className="flex-1" />
        <Button
          variant="ghost"
          className="h-8 px-3 text-[12px]"
          onClick={() => {
            openContent(inst.id);
            setScreen("instances");
          }}
        >
          {t("Manage content")}
        </Button>
      </div>
    </Card>
  );
}

/** The selected instance's game output: live while it runs, else the end of its last log file. */
export function LogPanel({ inst }: { inst: Instance }) {
  const live = useLauncher((s) => s.logs[inst.id]);
  const state = useLauncher((s) => statusOf(s.status, inst.id).state);
  const openLogs = useLauncher((s) => s.openLogs);
  const [saved, setSaved] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // Re-read the file when switching instances and when the game stops.
  useEffect(() => {
    if (state !== "idle") return;
    let alive = true;
    api
      .latestLog(inst.id)
      .then((l) => alive && setSaved(l))
      .catch(() => alive && setSaved([]));
    return () => {
      alive = false;
    };
  }, [inst.id, state]);

  const lines = live?.length ? live : saved;
  const source = t(live?.length ? (state === "running" ? "Live" : "This session") : "Last session");

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, inst.id]);

  const copy = () => {
    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <Card className="flex min-h-0 flex-1 flex-col p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-semibold">{t("Logs")}</h2>
        {lines.length > 0 && <Badge tone={state === "running" ? "success" : "neutral"}>{source}</Badge>}
        <div className="flex-1" />
        <Button variant="ghost" icon={copied ? Check : Copy} className="h-8 px-3 text-[12px]" onClick={copy} disabled={!lines.length}>
          {t(copied ? "Copied" : "Copy")}
        </Button>
        <Button variant="ghost" icon={Maximize2} className="h-8 px-3 text-[12px]" onClick={() => openLogs(inst.id)}>
          {t("Expand")}
        </Button>
      </div>
      <div
        ref={scroller}
        className="h-72 select-text overflow-auto rounded-lg bg-raised p-3 font-mono text-[11px] leading-relaxed"
      >
        {lines.length === 0 ? (
          <p className="text-muted">{t("No logs yet. Press Play and the game's output shows up here.")}</p>
        ) : (
          lines.slice(-400).map((l, i) => (
            <div key={i} className={`whitespace-pre-wrap break-all ${lineClass(l)}`}>
              {l}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function Stats({ instances }: { instances: Instance[] }) {
  const modded = instances.filter((i) => i.loader !== "vanilla").length;
  const total = instances.reduce((n, i) => n + i.playTimeSecs, 0);
  const item = (Icon: typeof Boxes, label: string, value: string, note: string) => (
    <div className="slot flex-1 rounded-lg bg-raised p-4">
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
        <Icon size={13} />
        {label}
      </p>
      <p className="display mt-2 text-[30px] font-semibold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{note}</p>
    </div>
  );
  return (
    <Card className="p-5">
      <h2 className="display mb-3 text-[17px] font-semibold">{t("Overview")}</h2>
      <div className="flex gap-2">
        {item(Boxes, t("Instances"), String(instances.length), t("{count} modded", { count: modded }))}
        {item(Clock, t("Play time"), playTime(total), t("all instances"))}
      </div>
    </Card>
  );
}

const news = [
  { title: "Themes", body: "Pick a color theme with liquid-glass panels in Settings → Appearance." },
  { title: "Mod updates", body: "Open an instance to see its mods and packs, and update them in one click." },
  { title: "Offline accounts", body: "Add offline accounts for singleplayer and LAN once you've signed in." },
];

function WhatsNew() {
  return (
    <Card className="p-5">
      <h2 className="display mb-3 text-[17px] font-semibold">{t("What's new")}</h2>
      <div className="flex flex-col gap-4">
        {news.map((n) => (
          <div key={n.title} className="flex gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-[2px] bg-accent" />
            <div>
              <p className="text-[13px] font-semibold">{t(n.title)}</p>
              <p className="text-[12px] leading-snug text-muted">{t(n.body)}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Welcome() {
  const openNewInstance = useLauncher((s) => s.openNewInstance);
  return (
    <Card className="flex items-center justify-between gap-4 p-6">
      <div>
        <p className="text-[17px] font-semibold">{t("Welcome to Novex")}</p>
        <p className="mt-1 text-[13px] text-muted">{t("Create an instance to pick a version, then hit play.")}</p>
      </div>
      <Button variant="primary" icon={Plus} onClick={() => openNewInstance(true)}>
        {t("New instance")}
      </Button>
    </Card>
  );
}

export function HomeScreen() {
  const instances = useLauncher((s) => s.instances);
  const current = useLauncher(selectedInstance);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="stagger flex flex-col gap-4">
        {current ? (
          <>
            <Hero inst={current} />
            <LogPanel inst={current} />
          </>
        ) : (
          <Welcome />
        )}
      </div>
      <div className="stagger flex flex-col gap-4 [&>*:nth-child(1)]:[animation-delay:90ms] [&>*:nth-child(2)]:[animation-delay:150ms]">
        <Stats instances={instances} />
        <WhatsNew />
      </div>
    </div>
  );
}
