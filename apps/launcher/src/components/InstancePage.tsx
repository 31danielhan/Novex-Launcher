import { t } from "../i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpCircle,
  FolderOpen,
  Globe,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  Swords,
  Trash2,
  Zap,
} from "lucide-react";
import {
  api,
  describe,
  errorText,
  inTauri,
  timeAgo,
  type ClientStatus,
  type ContentKind,
  type ContentUpdate,
  type Instance,
  type InstalledItem,
  type World,
} from "../lib/api";
import { statusOf, useLauncher } from "../launcher";
import { useApp } from "../store";
import { inputClass } from "./Dialog";
import { InstanceIcon, PlayButton, ProgressBar } from "./InstanceCard";
import { InstanceSettings } from "./InstanceSettings";
import { LiveSession } from "./LiveSession";
import { PageBackdrop } from "./VersionArt";
import { companions } from "../screens/Client";
import { FolderButton, playTime } from "../screens/Home";
import { Badge, Button, Card, EmptyState, Toggle, cx } from "./ui";

type Tab = Exclude<ContentKind, "modpack">;
type Section = "overview" | "worlds" | Tab | "settings";

const tabs: {
  value: Tab;
  label: string;
  folder: "mods" | "resourcepacks" | "shaderpacks";
}[] = [
  { value: "mod", label: "Mods", folder: "mods" },
  { value: "resourcepack", label: "Resource packs", folder: "resourcepacks" },
  { value: "shader", label: "Shaders", folder: "shaderpacks" },
];

export function ProjectIcon({
  url,
  title,
  size = 36,
}: {
  url: string | null;
  title: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-lg bg-raised object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="slot grid shrink-0 place-items-center rounded-lg bg-raised font-semibold text-muted"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {title[0] ?? "?"}
    </div>
  );
}

/** Novex Client for this instance: a switch, plus Update when a newer build is bundled. */
/** Whether an instance can move to Ornithe: Forge on 1.12.2 and older, or Legacy Fabric (1.13.2 and older). */
function canSwitchToOrnithe(inst: Instance) {
  const [major, minor] = inst.version.split(".").map(Number);
  if (major !== 1) return false;
  return (inst.loader === "forge" && minor < 13) || (inst.loader === "fabric" && minor < 14);
}

/** Offers to move an old Forge or Legacy Fabric instance to Ornithe, which runs it natively and much faster. */
function OrnitheCard({ inst }: { inst: Instance }) {
  const { refresh, setError, setNotice } = useLauncher();
  const state = useLauncher((s) => statusOf(s.status, inst.id).state);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const fabric = inst.loader === "fabric";

  const run = async () => {
    setBusy(true);
    try {
      await api.switchToOrnithe(inst.id);
      await refresh();
      setNotice(
        fabric
          ? t("Switched to Ornithe. Your Legacy Fabric mods are in the mods-fabric folder.")
          : t("Switched to Ornithe. Your Forge mods are in the mods-forge folder."),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      setAsking(false);
    }
  };

  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="slot grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-muted">
        <Zap size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">{t("Run faster on Ornithe")}</p>
        <p className="text-[12px] text-muted">
          {asking
            ? fabric
              ? t("Legacy Fabric mods don't work on Ornithe, so they'll be moved to a mods-fabric folder. Worlds, settings and packs stay.")
              : t("Forge mods don't work on Ornithe, so they'll be moved to a mods-forge folder. Worlds, settings and packs stay.")
            : fabric
              ? t("Ornithe is Fabric for old versions with OneClient's performance mods. It runs natively on Java 25, so it's much faster than Legacy Fabric.")
              : t("Ornithe runs old versions natively on Java 25, so they're much faster than on Forge, especially on Apple Silicon.")}
        </p>
      </div>
      {busy && <Loader2 size={15} className="animate-spin text-muted" />}
      {asking ? (
        <>
          <Button variant="ghost" disabled={busy} onClick={() => setAsking(false)}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" disabled={busy || state !== "idle"} onClick={run}>
            {t("Switch")}
          </Button>
        </>
      ) : (
        <Button disabled={state !== "idle"} onClick={() => setAsking(true)}>
          {t("Switch to Ornithe")}
        </Button>
      )}
    </Card>
  );
}

function ClientCard({
  inst,
  onChange,
}: {
  inst: Instance;
  onChange: () => void;
}) {
  const { setError } = useLauncher();
  const state = useLauncher((s) => statusOf(s.status, inst.id).state);
  const [status, setStatus] = useState<ClientStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (inTauri)
      api
        .clientStatus(inst.id)
        .then(setStatus)
        .catch((e) => setError(errorText(e)));
  }, [inst.id, setError]);

  const run = async (fn: () => Promise<ClientStatus>) => {
    setBusy(true);
    try {
      setStatus(await fn());
      onChange();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const on = !!status?.enabled;
  const stopped = state === "idle";
  const unsupported = status?.unsupported && !on ? status.unsupported : null;

  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="slot grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-muted">
        <Swords size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">{t("Novex Client")}</p>
        <p
          className="truncate text-[12px] text-muted"
          title={unsupported ?? undefined}
        >
          {unsupported ??
            (!stopped
              ? t("Close the game to change this.")
              : status?.outdated
                ? t("Update available")
                : on
                  ? t("Installed")
                  : (() => {
                      const mods = companions(inst.loader, inst.performanceMods ?? null);
                      return mods ? t("Also installs {mods}.", { mods }) : t("Off");
                    })())}
        </p>
      </div>
      {busy && <Loader2 size={15} className="animate-spin text-muted" />}
      {status?.outdated && (
        <Button
          variant="primary"
          icon={RefreshCw}
          className="h-8 px-3 text-[12px]"
          disabled={busy || !stopped}
          onClick={() => run(() => api.clientUpdate(inst.id))}
        >
          {t("Update")}
        </Button>
      )}
      <Toggle
        label={t("Novex Client")}
        checked={on}
        disabled={!status || !!unsupported || busy || !stopped}
        onChange={(v) => run(() => api.clientSetEnabled(inst.id, v))}
      />
    </Card>
  );
}

/** Singleplayer worlds, newest first. */
function Worlds({ inst }: { inst: Instance }) {
  const setError = useLauncher((s) => s.setError);
  const [worlds, setWorlds] = useState<World[] | null>(null);

  useEffect(() => {
    api
      .worlds(inst.id)
      .then(setWorlds)
      .catch((e) => {
        setWorlds([]);
        setError(errorText(e));
      });
  }, [inst.id, setError]);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{t("Worlds")}</h2>
        <FolderButton inst={inst} sub="saves" icon={FolderOpen}>
          {t("Open folder")}
        </FolderButton>
      </div>
      {worlds === null ? (
        <p className="flex items-center gap-2 py-10 text-[13px] text-muted">
          <Loader2 size={15} className="animate-spin" /> {t("Loading…")}
        </p>
      ) : worlds.length === 0 ? (
        <EmptyState
          icon={Globe}
          title={t("No worlds yet")}
          body={t("Worlds you create in this instance show up here.")}
        />
      ) : (
        <div className="-mx-2 flex flex-col">
          {worlds.map((w) => (
            <button
              key={w.path}
              onClick={() =>
                api.openPath(w.path).catch((e) => setError(errorText(e)))
              }
              title={t("Open folder")}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-fg/[0.04]"
            >
              <span className="slot grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-muted">
                <Globe size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">
                  {w.name}
                </span>
                <span className="block truncate text-[11px] text-muted">
                  {timeAgo(w.lastPlayed)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

/** A figure on the Overview tab. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex-1 p-4">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="display mt-1 truncate text-[22px] font-semibold">{value}</p>
    </Card>
  );
}

const keyOf = (i: { kind: ContentKind; file: string }) => `${i.kind}/${i.file}`;

/** An instance's own page: play, and its mods, resource packs and shaders with updates. */
export function InstancePage({ inst }: { inst: Instance }) {
  const {
    status,
    openContent,
    openLogs,
    setBrowseTarget,
    setError,
    setNotice,
  } = useLauncher();
  const setScreen = useApp((s) => s.setScreen);
  const [section, setSection] = useState<Section>("overview");
  const tab: Tab =
    section === "resourcepack" || section === "shader" ? section : "mod";
  const [items, setItems] = useState<InstalledItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [updates, setUpdates] = useState<Map<string, ContentUpdate> | null>(
    null,
  );
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      setItems(await api.installedContent(inst.id));
    } catch (e) {
      setItems((prev) => prev ?? []);
      setError(errorText(e));
    }
  }, [inst.id, setError]);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const list = await api.contentUpdates(inst.id);
      setUpdates(new Map(list.map((u) => [keyOf(u), u])));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setChecking(false);
    }
  }, [inst.id, setError]);

  useEffect(() => {
    setItems(null);
    setUpdates(null);
    load();
    check();
  }, [load, check]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    }
    load();
  };

  const update = async (list: ContentUpdate[]) => {
    if (!list.length) return;
    setUpdating((s) => new Set([...s, ...list.map(keyOf)]));
    let failed = 0;
    for (const u of list) {
      try {
        await api.installContent(
          inst.id,
          u.source,
          u.projectId,
          u.kind,
          u.versionId,
        );
        setUpdates((m) => {
          const next = new Map(m);
          next.delete(keyOf(u));
          return next;
        });
      } catch (e) {
        failed++;
        setError(errorText(e));
      } finally {
        setUpdating((s) => {
          const next = new Set(s);
          next.delete(keyOf(u));
          return next;
        });
      }
    }
    await load();
    const done = list.length - failed;
    if (done)
      setNotice(done === 1 ? "Updated 1 item." : `Updated ${done} items.`);
  };

  const browse = () => {
    setBrowseTarget(inst.id);
    setScreen("browse");
  };

  const openFolder = async () => {
    try {
      await api.openPath(
        await api.instanceFolder(
          inst.id,
          tabs.find((t) => t.value === tab)!.folder,
        ),
      );
    } catch (e) {
      setError(errorText(e));
    }
  };

  const count = (k: Tab) => items?.filter((i) => i.kind === k).length ?? 0;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter(
      (i) =>
        i.kind === tab &&
        (!q ||
          i.title.toLowerCase().includes(q) ||
          i.file.toLowerCase().includes(q)),
    );
  }, [items, tab, query]);
  const pending = [...(updates?.values() ?? [])];
  const pendingHere = pending.filter((u) => u.kind === tab);
  const s = statusOf(status, inst.id);
  const label = tabs.find((t) => t.value === tab)!.label;
  const sections: { value: Section; label: string }[] = [
    { value: "overview", label: "Overview" },
    { value: "worlds", label: "Worlds" },
    ...(inst.loader === "vanilla"
      ? []
      : [{ value: "mod" as const, label: "Mods" }]),
    { value: "resourcepack", label: "Resource packs" },
    { value: "shader", label: "Shaders" },
    { value: "settings", label: "Settings" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageBackdrop version={inst.version} />
      <button
        onClick={() => openContent(null)}
        className="flex w-fit items-center gap-1.5 rounded-md px-2 py-1 -ml-2 text-[13px] text-muted transition hover:bg-fg/5 hover:text-fg"
      >
        <ArrowLeft size={15} />
        {t("All instances")}
      </button>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <InstanceIcon inst={inst} size={64} />
          <div className="min-w-0 flex-1">
            <p className="display truncate text-[26px] font-bold leading-tight">
              {inst.name}
            </p>
            <p className="truncate text-[12px] text-muted">
              {describe(inst)} ·{" "}
              {s.state === "running" ? (
                <span className="text-success">{t("Running")}</span>
              ) : (
                timeAgo(inst.lastPlayed)
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            icon={ScrollText}
            onClick={() => openLogs(inst.id)}
          >
            {t("Logs")}
          </Button>
          <PlayButton inst={inst} large />
        </div>
        <ProgressBar s={s} />
      </Card>

      <div
        role="tablist"
        className="hairline flex gap-1 overflow-x-auto border-b"
      >
        {sections.map((x) => (
          <button
            key={x.value}
            role="tab"
            aria-selected={section === x.value}
            onClick={() => {
              setSection(x.value);
              setConfirm(null);
              setQuery("");
            }}
            className={cx(
              "-mb-px shrink-0 border-b-2 px-3.5 py-2 text-[13px] font-medium transition",
              section === x.value
                ? "border-accent text-fg"
                : "border-transparent text-muted hover:text-fg",
            )}
          >
            {t(x.label)}
            {x.value !== "overview" &&
              x.value !== "worlds" &&
              x.value !== "settings" &&
              count(x.value) > 0 && (
                <span className="ml-1.5 text-[11px] text-muted">
                  {count(x.value)}
                </span>
              )}
          </button>
        ))}
      </div>

      {section === "overview" && (
        <>
          {canSwitchToOrnithe(inst) && <OrnitheCard inst={inst} />}
          <ClientCard inst={inst} onChange={load} />
          <LiveSession inst={inst} />
          <div className="flex gap-3">
            <Stat label={t("Play time")} value={playTime(inst.playTimeSecs)} />
            <Stat label={t("Last played")} value={timeAgo(inst.lastPlayed)} />
            {inst.loader !== "vanilla" && (
              <Stat label={t("Mods")} value={String(count("mod"))} />
            )}
            <Stat label={t("Updates")} value={String(pending.length)} />
          </div>
        </>
      )}
      {section === "worlds" && <Worlds inst={inst} />}
      {section === "settings" && <InstanceSettings inst={inst} />}

      {(section === "mod" ||
        section === "resourcepack" ||
        section === "shader") && (
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative w-52">
              <Search
                size={14}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Filter ${label.toLowerCase()}`}
                spellCheck={false}
                className={cx(inputClass, "pl-9")}
              />
            </div>
            <div className="flex-1" />
            <Button
              variant="ghost"
              icon={FolderOpen}
              onClick={openFolder}
              title={t("Open this folder")}
            >
              {t("Folder")}
            </Button>
            <Button icon={Plus} onClick={browse}>
              {t("Add")}
            </Button>
          </div>

          <div className="mb-3 flex items-center gap-3 rounded-lg bg-raised px-3 py-2.5 text-[12px]">
            {checking ? (
              <span className="flex items-center gap-2 text-muted">
                <Loader2 size={14} className="animate-spin" /> {t("Checking for updates…")}
              </span>
            ) : pending.length ? (
              <span className="flex items-center gap-2">
                <ArrowUpCircle size={14} className="text-success" />
                {pending.length === 1
                  ? t("1 update available")
                  : t("{count} updates available", { count: pending.length })}
              </span>
            ) : (
              <span className="text-muted">
                {updates
                  ? t("Everything from Modrinth and CurseForge is up to date.")
                  : t("Updates weren't checked.")}
              </span>
            )}
            <div className="flex-1" />
            <Button
              variant="ghost"
              icon={RefreshCw}
              className="h-7 px-3 text-[12px]"
              onClick={check}
              disabled={checking}
            >
              {t("Check")}
            </Button>
            {pendingHere.length > 0 && (
              <Button
                variant="primary"
                className="h-7 px-3 text-[12px]"
                disabled={updating.size > 0}
                onClick={() => update(pendingHere)}
              >
                {t(`Update all ${label.toLowerCase()}`)}
              </Button>
            )}
          </div>

          {items === null ? (
            <p className="flex items-center gap-2 py-10 text-[13px] text-muted">
              <Loader2 size={15} className="animate-spin" /> {t("Loading…")}
            </p>
          ) : shown.length === 0 ? (
            query ? (
              <p className="py-10 text-center text-[13px] text-muted">
                {t("Nothing matches “{query}”.", { query })}
              </p>
            ) : (
              <EmptyState
                icon={Package}
                title={t(`No ${label.toLowerCase()} yet`)}
                body={
                  tab === "mod" && inst.loader === "vanilla"
                    ? t("This is a vanilla instance. Mods need Fabric, Quilt, Ornithe, Forge or NeoForge.")
                    : t("Find something in Browse, or drop files into the folder.")
                }
                action={
                  <Button icon={Plus} onClick={browse}>
                    {t("Browse")}
                  </Button>
                }
              />
            )
          ) : (
            <div className="-mx-2 flex flex-col">
              {shown.map((i) => {
                const key = keyOf(i);
                const up = updates?.get(key);
                const busy = updating.has(key);
                return (
                  <div
                    key={key}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-fg/[0.04]"
                  >
                    <ProjectIcon url={i.iconUrl} title={i.title} />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cx(
                          "truncate text-[13px] font-medium",
                          !i.enabled && "text-muted line-through",
                        )}
                      >
                        {i.title}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {i.version ?? i.file}
                        {up && (
                          <span className="text-success"> → {up.version}</span>
                        )}
                        {!i.source && ` · ${t("added by hand")}`}
                      </p>
                    </div>
                    {up &&
                      (busy ? (
                        <Badge>
                          <span className="flex items-center gap-1">
                            <Loader2 size={11} className="animate-spin" />{" "}
                            {t("Updating")}
                          </span>
                        </Badge>
                      ) : (
                        <Button
                          className="h-7 px-3 text-[12px]"
                          icon={ArrowUpCircle}
                          disabled={updating.size > 0}
                          onClick={() => update([up])}
                        >
                          {t("Update")}
                        </Button>
                      ))}
                    <button
                      aria-label={
                        confirm === key
                          ? t("Click again to remove")
                          : t("Remove {name}", { name: i.title })
                      }
                      title={
                        confirm === key ? t("Click again to remove") : t("Remove")
                      }
                      onClick={() =>
                        confirm === key
                          ? act(() =>
                              api.removeContent(inst.id, i.kind, i.file),
                            ).then(() => setConfirm(null))
                          : setConfirm(key)
                      }
                      className="grid h-8 min-w-8 place-items-center rounded-md px-2 text-muted opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      {confirm === key ? (
                        <span className="text-[11px] font-semibold">
                          {t("Sure?")}
                        </span>
                      ) : (
                        <Trash2 size={15} />
                      )}
                    </button>
                    <Toggle
                      label={t(i.enabled ? "Disable {name}" : "Enable {name}", { name: i.title })}
                      checked={i.enabled}
                      onChange={(on) =>
                        act(() =>
                          api.setContentEnabled(inst.id, i.kind, i.file, on),
                        )
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
