import { t } from "../i18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  Copy,
  FolderOpen,
  Maximize2,
  Plus,
  Settings2,
} from "lucide-react";
import { useApp } from "../store";
import { selectedInstance, statusOf, useLauncher } from "../launcher";
import { api, describe, errorText, timeAgo, type Instance, type InstanceFolder } from "../lib/api";
import { Badge, Button, Card, cx } from "../components/ui";
import { PlayButton, ProgressBar } from "../components/InstanceCard";
import { VersionArt } from "../components/VersionArt";
import { lineClass } from "../components/LogsDialog";

export function playTime(secs: number) {
  const h = secs / 3600;
  if (h >= 10) return `${Math.round(h)}h`;
  if (h >= 1) return `${h.toFixed(1).replace(/\.0$/, "")}h`;
  return `${Math.round(secs / 60)}m`;
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
    <Card className="relative isolate flex h-[clamp(300px,58vh,560px)] flex-col justify-end overflow-hidden p-6">
      <VersionArt version={inst.version} className="absolute inset-0 -z-10" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="flex items-end gap-4">
        <div className="min-w-0 flex-1 text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]">
          <p className="display truncate text-[34px] font-bold leading-tight">{inst.name}</p>
          <p className="truncate text-[13px] text-white/80">
            {describe(inst)}
            {inst.lastPlayed ? ` · ${t("Last played {time}", { time: timeAgo(inst.lastPlayed) })}` : ""}
          </p>
        </div>
        <Button
          icon={Settings2}
          className="h-10 px-4"
          onClick={() => {
            openContent(inst.id);
            setScreen("instances");
          }}
        >
          {t("Manage")}
        </Button>
        <PlayButton inst={inst} large />
      </div>
      <ProgressBar s={statusOf(status, inst.id)} />
    </Card>
  );
}

/** Every instance in one row: a click switches to it. */
function InstanceRow({ current }: { current: Instance }) {
  const { instances, status, select, openNewInstance } = useLauncher();
  return (
    <div role="listbox" aria-label={t("Instances")} className="flex gap-3 overflow-x-auto p-0.5 pb-2">
      {instances.map((i) => {
        const on = i.id === current.id;
        const running = statusOf(status, i.id).state === "running";
        return (
          <button
            key={i.id}
            role="option"
            aria-selected={on}
            onClick={() => select(i.id)}
            className={cx(
              "relative isolate flex h-28 w-48 shrink-0 flex-col justify-end overflow-hidden rounded-xl p-3 text-left text-white outline outline-2 outline-offset-2 transition",
              on ? "outline-accent" : "outline-transparent hover:outline-fg/20",
            )}
          >
            <VersionArt version={i.version} className="absolute inset-0 -z-10" />
            <span className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 to-transparent" />
            {running && (
              <span className="absolute right-2 top-2">
                <Badge tone="success">{t("Running")}</Badge>
              </span>
            )}
            <span className="truncate text-[13px] font-semibold [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">{i.name}</span>
            <span className="truncate text-[11px] text-white/80">{describe(i)}</span>
          </button>
        );
      })}
      <button
        onClick={() => openNewInstance(true)}
        className="flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-fg/20 text-[12px] text-muted transition hover:border-fg/40 hover:text-fg"
      >
        <Plus size={18} />
        {t("New instance")}
      </button>
    </div>
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
  const current = useLauncher(selectedInstance);

  return (
    <div className="stagger flex flex-col gap-4">
      {current ? (
        <>
          <Hero inst={current} />
          <InstanceRow current={current} />
        </>
      ) : (
        <Welcome />
      )}
    </div>
  );
}
