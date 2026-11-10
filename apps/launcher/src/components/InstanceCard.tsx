import { t } from "../i18n";
import { Loader2, Play, Square } from "lucide-react";
import { describe, loaderLabels, timeAgo, type Instance } from "../lib/api";
import { statusOf, useLauncher, type Status } from "../launcher";
import { Button, Card, cx } from "./ui";
import fabricIcon from "../assets/fabric.png";
import forgeIcon from "../assets/forge.png";
import neoforgeIcon from "../assets/neoforge.png";
import quiltIcon from "../assets/quilt.svg";
import vanillaIcon from "../assets/vanilla.svg";
import { VersionArt } from "./VersionArt";

// Soft gradient per loader, like product thumbnails.
const loaderTint: Record<Instance["loader"], string> = {
  vanilla: "from-emerald-300 to-lime-200 text-emerald-900",
  fabric: "from-amber-200 to-orange-100 text-amber-900",
  quilt: "from-fuchsia-300 to-violet-200 text-fuchsia-900",
  ornithe: "from-sky-300 to-cyan-100 text-sky-900",
  forge: "from-slate-400 to-slate-200 text-slate-900",
  neoforge: "from-orange-300 to-rose-200 text-orange-900",
};

// Each loader's own logo. Forge's is pale, so it's darkened to show on its tile.
const loaderIcon: Record<Instance["loader"], { src: string; className?: string }> = {
  vanilla: { src: vanillaIcon, className: "[image-rendering:pixelated]" },
  fabric: { src: fabricIcon, className: "[image-rendering:pixelated]" },
  quilt: { src: quiltIcon },
  // Ornithe is Fabric Loader for old versions.
  ornithe: { src: fabricIcon, className: "[image-rendering:pixelated]" },
  forge: { src: forgeIcon, className: "brightness-[0.3]" },
  neoforge: { src: neoforgeIcon, className: "[image-rendering:pixelated]" },
};

export function InstanceIcon({ inst, size = 44 }: { inst: Instance; size?: number }) {
  const icon = inst.modpack?.iconUrl;
  if (icon) {
    return (
      <img
        src={icon}
        alt=""
        className="slot shrink-0 rounded-lg bg-raised object-cover [image-rendering:pixelated]"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={cx(
        "slot grid shrink-0 place-items-center rounded-lg bg-gradient-to-br font-display font-bold",
        loaderTint[inst.loader],
      )}
      style={{ width: size, height: size, fontSize: size * 0.25 }}
    >
      <img
        src={loaderIcon[inst.loader].src}
        alt={loaderLabels[inst.loader]}
        draggable={false}
        className={cx("object-contain", loaderIcon[inst.loader].className)}
        style={{ width: size * 0.66, height: size * 0.66 }}
      />
    </div>
  );
}

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
        {t("Stop")}
      </Button>
    );
  }
  if (s.state === "launching") {
    return (
      <Button variant="primary" disabled className={size}>
        <Loader2 size={16} className="animate-spin" />
        {t("Launching")}
      </Button>
    );
  }
  return (
    <Button variant="primary" icon={Play} onClick={() => launch(inst.id)} className={size}>
      {t("Play")}
    </Button>
  );
}

export function ProgressBar({ s }: { s: Status }) {
  if (s.state !== "launching") return null;
  const pct = s.total > 0 ? (s.done / s.total) * 100 : null;
  return (
    <div className="mt-3">
      <div className="slot h-1.5 overflow-hidden rounded-sm bg-fg/10">
        <div
          className={cx("h-full bg-success transition-all", pct === null && "w-1/3 animate-pulse")}
          style={pct === null ? undefined : { width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 truncate text-[12px] text-muted">{progressLabel(s)}</p>
    </div>
  );
}

export function InstanceCard({ inst }: { inst: Instance }) {
  const { status, openContent } = useLauncher();
  const s = statusOf(status, inst.id);

  return (
    <Card className="lift-card relative isolate flex h-52 flex-col justify-end overflow-hidden p-4">
      <VersionArt version={inst.version} className="absolute inset-0 -z-10" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <button
        onClick={() => openContent(inst.id)}
        aria-label={`Open ${inst.name}`}
        className="absolute inset-0"
      />
      <div className="pointer-events-none relative flex items-center gap-3">
        <InstanceIcon inst={inst} size={40} />
        <div className="min-w-0 flex-1 text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
          <p className="truncate font-semibold">{inst.name}</p>
          <p className="truncate text-[12px] text-white/80">
            {describe(inst)} · {s.state === "running" ? t("Running") : timeAgo(inst.lastPlayed)}
          </p>
        </div>
        <div className="pointer-events-auto">
          <PlayButton inst={inst} />
        </div>
      </div>
      <div className="relative">
        <ProgressBar s={s} />
      </div>
    </Card>
  );
}
