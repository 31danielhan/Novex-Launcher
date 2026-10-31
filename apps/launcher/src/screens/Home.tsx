import type { ReactNode } from "react";
import { Boxes, Clock, Plus, Sparkles } from "lucide-react";
import { useApp } from "../store";
import { useLauncher, statusOf } from "../launcher";
import { describe, loaderLabels, timeAgo, type Instance, type LoaderKind } from "../lib/api";
import { Badge, Button, Card, cx } from "../components/ui";
import { InstanceIcon, PlayButton, ProgressBar } from "../components/InstanceCard";

function playTime(secs: number) {
  const h = secs / 3600;
  if (h >= 10) return `${Math.round(h)}h`;
  if (h >= 1) return `${h.toFixed(1).replace(/\.0$/, "")}h`;
  return `${Math.round(secs / 60)}m`;
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
  raised,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
  note?: ReactNode;
  raised?: boolean;
}) {
  return (
    <div className={cx("flex-1 rounded-lg p-5", raised && "shadow-card bg-surface")}>
      <p className="flex items-center gap-2 text-[13px] font-medium">
        <Icon size={15} className="text-muted" />
        {label}
      </p>
      <div className="mt-3 flex items-end gap-3">
        <span className="text-[40px] font-medium leading-none tracking-tight">{value}</span>
        {note && <span className="pb-1">{note}</span>}
      </div>
    </div>
  );
}

function Overview({ instances }: { instances: Instance[] }) {
  const modded = instances.filter((i) => i.loader !== "vanilla").length;
  const total = instances.reduce((n, i) => n + i.playTimeSecs, 0);
  const status = useLauncher((s) => s.status);
  const last = instances[0];

  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold">Overview</h2>
      <div className="flex gap-2 rounded-xl bg-raised p-1.5">
        <Stat
          raised
          icon={Boxes}
          label="Instances"
          value={String(instances.length)}
          note={<Badge tone="success">{modded} modded</Badge>}
        />
        <Stat
          icon={Clock}
          label="Play time"
          value={playTime(total)}
          note={<span className="text-[12px] text-muted">across all instances</span>}
        />
      </div>

      {last ? (
        <div className="mt-5 flex items-center gap-4">
          <InstanceIcon inst={last} size={52} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-muted">
              {last.lastPlayed ? `Last played ${timeAgo(last.lastPlayed)}` : "Ready to play"}
            </p>
            <p className="truncate text-[15px] font-semibold">{last.name}</p>
            <p className="truncate text-[12px] text-muted">{describe(last)}</p>
          </div>
          <PlayButton inst={last} large />
        </div>
      ) : (
        <div className="mt-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">No instance yet</p>
            <p className="text-[12px] text-muted">Create one to pick a version, then hit play.</p>
          </div>
          <CreateButton />
        </div>
      )}
      {last && <ProgressBar s={statusOf(status, last.id)} />}
    </Card>
  );
}

function CreateButton() {
  const openNewInstance = useLauncher((s) => s.openNewInstance);
  return (
    <Button variant="primary" icon={Plus} onClick={() => openNewInstance(true)}>
      New instance
    </Button>
  );
}

const loaders: LoaderKind[] = ["vanilla", "fabric", "quilt", "forge", "neoforge"];

/** Instances per loader, drawn like a soft bar chart with the top loader highlighted. */
function LoaderChart({ instances }: { instances: Instance[] }) {
  const counts = loaders.map((l) => instances.filter((i) => i.loader === l).length);
  const max = Math.max(1, ...counts);
  const top = counts.indexOf(Math.max(...counts));

  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Loaders</h2>
        <span className="text-[12px] text-muted">Instances per loader</span>
      </div>
      <div className="flex h-44 items-end gap-3 pt-6">
        {loaders.map((l, i) => {
          const hot = counts[i] > 0 && i === top;
          return (
            <div key={l} className="flex h-full flex-1 flex-col items-center gap-2">
              <div className="relative w-full max-w-[48px] flex-1">
                <div
                  className={cx(
                    "absolute inset-x-0 bottom-0 rounded-lg transition-all",
                    hot ? "bg-gradient-to-t from-success/40 to-success" : "bg-fg/[0.07]",
                  )}
                  style={{ height: `${Math.max(6, (counts[i] / max) * 100)}%` }}
                  title={`${loaderLabels[l]}: ${counts[i]}`}
                >
                  {hot && (
                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-fg">
                      {counts[i]}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-muted">{loaderLabels[l]}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function InstanceList({ instances }: { instances: Instance[] }) {
  const status = useLauncher((s) => s.status);
  const setScreen = useApp((s) => s.setScreen);

  return (
    <Card className="p-5">
      <h2 className="mb-3 font-semibold">Your instances</h2>
      {instances.length === 0 && (
        <p className="py-6 text-center text-[13px] text-muted">Instances you create show up here.</p>
      )}
      <div className="-mx-2 flex flex-col">
        {instances.slice(0, 5).map((i) => {
          const s = statusOf(status, i.id).state;
          return (
            <div key={i.id} className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-raised">
              <InstanceIcon inst={i} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{i.name}</p>
                <p className="truncate text-[11px] text-muted">{describe(i)}</p>
              </div>
              {s === "running" ? (
                <Badge tone="success">Running</Badge>
              ) : s === "launching" ? (
                <Badge>Starting</Badge>
              ) : (
                <span className="text-[11px] text-muted">{timeAgo(i.lastPlayed)}</span>
              )}
            </div>
          );
        })}
      </div>
      <Button className="mt-3 w-full" onClick={() => setScreen("instances")}>
        All instances
      </Button>
    </Card>
  );
}

const news = [
  { title: "Mod loaders", body: "Fabric, Quilt, Forge and NeoForge instances, including legacy versions." },
  { title: "Microsoft sign-in", body: "Sign in with your Microsoft account. Java is downloaded for you." },
];

function WhatsNew() {
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-semibold">What's new</h2>
      <div className="flex flex-col gap-4">
        {news.map((n) => (
          <div key={n.title} className="flex gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-raised text-muted">
              <Sparkles size={14} />
            </div>
            <div>
              <p className="text-[13px] font-semibold">{n.title}</p>
              <p className="text-[12px] leading-snug text-muted">{n.body}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function HomeScreen() {
  const instances = useLauncher((s) => s.instances);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-4">
        <Overview instances={instances} />
        <LoaderChart instances={instances} />
      </div>
      <div className="flex flex-col gap-4">
        <InstanceList instances={instances} />
        <WhatsNew />
      </div>
    </div>
  );
}
