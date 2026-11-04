import { useEffect, useState } from "react";
import { Camera, Cpu, FolderOpen, Gauge, Globe, MemoryStick, Package, Palette, Swords, Timer } from "lucide-react";
import { t } from "../i18n";
import { statusOf, useLauncher } from "../launcher";
import { api, inTauri, type ClientStatus, type Instance, type InstanceStats } from "../lib/api";
import { gamePhase, phaseSteps, type Phase } from "../lib/phase";
import { useApp } from "../store";
import { FolderButton, LogPanel, playTime } from "../screens/Home";
import { Badge, Button, Card, cx } from "./ui";

const phaseLabel: Record<Phase, string> = {
  preparing: "Preparing",
  loading: "Loading game",
  menu: "In menus",
  joining: "Joining world",
  playing: "Playing",
  saving: "Saving",
  closing: "Closing",
};

const phaseHint: Record<Phase, string> = {
  preparing: "Checking files, Java and your account.",
  loading: "Minecraft is starting and loading resources.",
  menu: "On the title screen or in a menu.",
  joining: "Loading a world or connecting to a server.",
  playing: "In a world.",
  saving: "Writing the world to disk. Wait before closing the game.",
  closing: "Saving and shutting down.",
};

function clock(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** Live view of a starting or running instance, shown at the top of its page. */
export function LiveSession({ inst }: { inst: Instance }) {
  const status = useLauncher((s) => statusOf(s.status, inst.id));
  const logs = useLauncher((s) => s.logs[inst.id]);
  const select = useLauncher((s) => s.select);
  const setScreen = useApp((s) => s.setScreen);
  const [stats, setStats] = useState<InstanceStats | null>(null);
  const [client, setClient] = useState<ClientStatus | null>(null);
  const [now, setNow] = useState(() => Date.now() / 1000);
  const phase = gamePhase(status, logs);
  const active = status.state !== "idle";

  // Poll once a second while the game is up; the clock ticks with it.
  useEffect(() => {
    if (!active) return setStats(null);
    let alive = true;
    const poll = () => {
      setNow(Date.now() / 1000);
      if (inTauri) api.instanceStats(inst.id).then((s) => alive && setStats(s)).catch(() => {});
    };
    poll();
    const timer = setInterval(poll, 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [active, inst.id]);

  useEffect(() => {
    if (inTauri) api.clientStatus(inst.id).then(setClient).catch(() => setClient(null));
  }, [inst.id]);

  if (!phase) return null;
  const session = stats ? Math.max(0, now - stats.startedAt) : 0;
  const step = phaseSteps.indexOf(phase);
  const busy = phase === "saving" || phase === "closing";
  const memPct = stats && stats.maxMemoryMb ? Math.min(100, (stats.memoryMb / stats.maxMemoryMb) * 100) : null;

  const openClient = () => {
    select(inst.id);
    setScreen("client");
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={cx(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                busy ? "bg-amber-500" : "bg-success",
              )}
            />
            <span className={cx("relative inline-flex h-2.5 w-2.5 rounded-full", busy ? "bg-amber-500" : "bg-success")} />
          </span>
          <h2 className="display text-[19px] font-semibold">{t(phaseLabel[phase])}</h2>
          <p className="text-[13px] text-muted">
            {status.state === "launching" && status.stage ? `${t(status.stage)} · ` : ""}
            {t(phaseHint[phase])}
          </p>
        </div>

        {/* The usual path from launch to playing; saving and closing light the track amber. */}
        <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label={t("Progress")}>
          {phaseSteps.map((p, i) => {
            const done = busy ? true : i <= step;
            return (
              <li key={p} className="min-w-0">
                <div
                  className={cx(
                    "h-1.5 rounded-sm transition-colors duration-500",
                    done ? (busy ? "bg-amber-500" : "bg-accent") : "bg-fg/10",
                  )}
                />
                <p className={cx("mt-1.5 truncate text-[11px]", i === step && !busy ? "font-medium text-fg" : "text-muted")}>
                  {t(phaseLabel[p])}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Tile icon={Timer} label={t("This session")} value={stats ? clock(session) : "—"} />
          <Tile icon={Gauge} label={t("Play time")} value={playTime(inst.playTimeSecs + session)} />
          <Tile
            icon={MemoryStick}
            label={t("Memory")}
            value={stats ? `${(stats.memoryMb / 1024).toFixed(1)} GB` : "—"}
            note={stats ? t("of {max} GB", { max: (stats.maxMemoryMb / 1024).toFixed(1).replace(/\.0$/, "") }) : undefined}
            meter={memPct}
          />
          <Tile icon={Cpu} label="CPU" value={stats ? `${Math.round(stats.cpu)}%` : "—"} meter={stats?.cpu ?? null} />
          <Tile
            icon={Gauge}
            label="GPU"
            value={stats?.gpu != null ? `${Math.round(stats.gpu)}%` : "—"}
            note={stats && stats.gpu == null ? t("Not reported here") : t("Whole system")}
            meter={stats?.gpu ?? null}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <LogPanel inst={inst} />
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Swords size={15} className="text-muted" />
              <h3 className="text-[14px] font-semibold">{t("Novex Client")}</h3>
              <div className="flex-1" />
              {client &&
                (client.enabled ? (
                  <Badge tone="success">{t("On")}</Badge>
                ) : (
                  <Badge>{t(client.unsupported ? "Not available" : "Off")}</Badge>
                ))}
            </div>
            <p className="text-[12px] leading-snug text-muted">
              {client?.enabled
                ? t("Right Shift opens its menu in game.")
                : (client?.unsupported ?? t("Turn it on to add the HUD to this instance."))}
            </p>
            <Button className="mt-3 h-8 w-full text-[12px]" onClick={openClient}>
              {t("Open Novex Client")}
            </Button>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-[14px] font-semibold">{t("Files")}</h3>
            <div className="flex flex-wrap gap-2">
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
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  note,
  meter,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  note?: string;
  meter?: number | null;
}) {
  return (
    <div className="slot rounded-lg bg-raised p-3.5">
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
        <Icon size={13} />
        {label}
      </p>
      <p className="display mt-1.5 text-[22px] font-semibold leading-none tabular-nums">{value}</p>
      {meter != null && (
        <div className="mt-2 h-1 overflow-hidden rounded-sm bg-fg/10">
          <div
            className={cx("h-full transition-[width] duration-700", meter > 85 ? "bg-danger" : "bg-accent")}
            style={{ width: `${Math.max(2, meter)}%` }}
          />
        </div>
      )}
      {note && <p className="mt-1.5 truncate text-[11px] text-muted">{note}</p>}
    </div>
  );
}
