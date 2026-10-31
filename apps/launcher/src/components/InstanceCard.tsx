import { useEffect, useState, type ReactNode } from "react";
import {
  FolderOpen,
  Loader2,
  Play,
  ScrollText,
  SlidersHorizontal,
  Square,
  Trash2,
} from "lucide-react";
import { api, describe, errorText, loaderLabels, timeAgo, type Instance } from "../lib/api";
import { statusOf, useLauncher, type Status } from "../launcher";
import { Button, Card, cx } from "./ui";

export function progressLabel(s: Status) {
  if (s.state !== "launching") return "";
  return s.total > 0 ? `${s.stage} · ${s.done}/${s.total}` : `${s.stage}…`;
}

export function PlayButton({ inst, large }: { inst: Instance; large?: boolean }) {
  const { status, launch, kill } = useLauncher();
  const s = statusOf(status, inst.id);
  const size = large ? "h-10 px-6" : "h-8 px-3";
  if (s.state === "running") {
    return (
      <Button icon={Square} onClick={() => kill(inst.id)} className={size}>
        Stop
      </Button>
    );
  }
  if (s.state === "launching") {
    return (
      <Button variant="primary" disabled className={size}>
        <Loader2 size={16} className="animate-spin" />
        Launching
      </Button>
    );
  }
  return (
    <Button variant="primary" icon={Play} onClick={() => launch(inst.id)} className={size}>
      Play
    </Button>
  );
}

export function ProgressBar({ s }: { s: Status }) {
  if (s.state !== "launching") return null;
  const pct = s.total > 0 ? (s.done / s.total) * 100 : null;
  return (
    <div className="mt-3">
      <div className="h-1 overflow-hidden rounded-full bg-fg/10">
        <div
          className={cx("h-full rounded-full bg-accent transition-all", pct === null && "w-1/3 animate-pulse")}
          style={pct === null ? undefined : { width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 truncate text-[12px] text-muted">{progressLabel(s)}</p>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        "grid h-8 w-8 place-items-center rounded text-muted transition",
        danger ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-fg/5 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

export function InstanceCard({ inst }: { inst: Instance }) {
  const { status, openLogs, openInstanceSettings, refresh, setError } = useLauncher();
  const s = statusOf(status, inst.id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const openFolder = async () => {
    try {
      await api.openPath(await api.instanceFolder(inst.id));
    } catch (e) {
      setError(errorText(e));
    }
  };

  const remove = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    try {
      await api.deleteInstance(inst.id);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <Card className="group p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-accent/30 to-accent/5 text-[11px] font-semibold text-accent">
          {inst.loader === "vanilla"
            ? inst.version.length > 6
              ? "MC"
              : inst.version
            : loaderLabels[inst.loader].slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{inst.name}</p>
          <p className="truncate text-[12px] text-muted">
            {describe(inst)} ·{" "}
            {s.state === "running" ? <span className="text-success">Running</span> : timeAgo(inst.lastPlayed)}
          </p>
        </div>
      </div>

      <ProgressBar s={s} />

      <div className="mt-4 flex items-center justify-between">
        <PlayButton inst={inst} />
        <div className="flex gap-0.5 opacity-60 transition group-hover:opacity-100">
          <IconAction label="Logs" onClick={() => openLogs(inst.id)}>
            <ScrollText size={15} />
          </IconAction>
          <IconAction label="Open folder" onClick={openFolder}>
            <FolderOpen size={15} />
          </IconAction>
          <IconAction label="Instance settings" onClick={() => openInstanceSettings(inst.id)}>
            <SlidersHorizontal size={15} />
          </IconAction>
          <IconAction label={confirmDelete ? "Click again to delete" : "Delete"} onClick={remove} danger>
            {confirmDelete ? <span className="text-[11px] font-semibold">Sure?</span> : <Trash2 size={15} />}
          </IconAction>
        </div>
      </div>
    </Card>
  );
}
