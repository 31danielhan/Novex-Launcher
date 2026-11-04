import { t } from "../i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpCircle,
  FolderOpen,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  api,
  describe,
  errorText,
  timeAgo,
  type ContentKind,
  type ContentUpdate,
  type Instance,
  type InstalledItem,
} from "../lib/api";
import { statusOf, useLauncher } from "../launcher";
import { useApp } from "../store";
import { inputClass } from "./Dialog";
import { InstanceIcon, PlayButton, ProgressBar } from "./InstanceCard";
import { LiveSession } from "./LiveSession";
import { Badge, Button, Card, EmptyState, Segmented, Toggle, cx } from "./ui";

type Tab = Exclude<ContentKind, "modpack">;

const tabs: { value: Tab; label: string; folder: "mods" | "resourcepacks" | "shaderpacks" }[] = [
  { value: "mod", label: "Mods", folder: "mods" },
  { value: "resourcepack", label: "Resource packs", folder: "resourcepacks" },
  { value: "shader", label: "Shaders", folder: "shaderpacks" },
];

export function ProjectIcon({ url, title, size = 36 }: { url: string | null; title: string; size?: number }) {
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

const keyOf = (i: { kind: ContentKind; file: string }) => `${i.kind}/${i.file}`;

/** An instance's own page: play, and its mods, resource packs and shaders with updates. */
export function InstancePage({ inst }: { inst: Instance }) {
  const { status, openContent, openLogs, openInstanceSettings, setBrowseTarget, setError, setNotice } =
    useLauncher();
  const setScreen = useApp((s) => s.setScreen);
  const [tab, setTab] = useState<Tab>(inst.loader === "vanilla" ? "resourcepack" : "mod");
  const [items, setItems] = useState<InstalledItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [updates, setUpdates] = useState<Map<string, ContentUpdate> | null>(null);
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
        await api.installContent(inst.id, u.source, u.projectId, u.kind, u.versionId);
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
    if (done) setNotice(done === 1 ? "Updated 1 item." : `Updated ${done} items.`);
  };

  const browse = () => {
    setBrowseTarget(inst.id);
    setScreen("browse");
  };

  const openFolder = async () => {
    try {
      await api.openPath(await api.instanceFolder(inst.id, tabs.find((t) => t.value === tab)!.folder));
    } catch (e) {
      setError(errorText(e));
    }
  };

  const count = (k: Tab) => items?.filter((i) => i.kind === k).length ?? 0;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter(
      (i) => i.kind === tab && (!q || i.title.toLowerCase().includes(q) || i.file.toLowerCase().includes(q)),
    );
  }, [items, tab, query]);
  const pending = [...(updates?.values() ?? [])];
  const pendingHere = pending.filter((u) => u.kind === tab);
  const s = statusOf(status, inst.id);
  const label = tabs.find((t) => t.value === tab)!.label;

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => openContent(null)}
        className="flex w-fit items-center gap-1.5 rounded-md px-2 py-1 -ml-2 text-[13px] text-muted transition hover:bg-fg/5 hover:text-fg"
      >
        <ArrowLeft size={15} />
        All instances
      </button>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <InstanceIcon inst={inst} size={64} />
          <div className="min-w-0 flex-1">
            <p className="display truncate text-[26px] font-bold leading-tight">{inst.name}</p>
            <p className="truncate text-[12px] text-muted">
              {describe(inst)} ·{" "}
              {s.state === "running" ? <span className="text-success">{t("Running")}</span> : timeAgo(inst.lastPlayed)}
            </p>
          </div>
          <Button variant="ghost" icon={ScrollText} onClick={() => openLogs(inst.id)}>
            {t("Logs")}
          </Button>
          <Button variant="ghost" icon={SlidersHorizontal} onClick={() => openInstanceSettings(inst.id)}>
            {t("Settings")}
          </Button>
          <PlayButton inst={inst} large />
        </div>
        <ProgressBar s={s} />
      </Card>

      <LiveSession inst={inst} />

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Segmented
            value={tab}
            onChange={(t) => {
              setTab(t);
              setConfirm(null);
            }}
            options={tabs.map((tab) => ({ value: tab.value, label: `${t(tab.label)} ${count(tab.value) || ""}`.trim() }))}
          />
          <div className="flex-1" />
          <div className="relative w-52">
            <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}`}
              spellCheck={false}
              className={cx(inputClass, "pl-9")}
            />
          </div>
          <Button variant="ghost" icon={FolderOpen} onClick={openFolder} title="Open this folder">
            Folder
          </Button>
          <Button icon={Plus} onClick={browse}>
            Add
          </Button>
        </div>

        <div className="mb-3 flex items-center gap-3 rounded-lg bg-raised px-3 py-2.5 text-[12px]">
          {checking ? (
            <span className="flex items-center gap-2 text-muted">
              <Loader2 size={14} className="animate-spin" /> Checking for updates…
            </span>
          ) : pending.length ? (
            <span className="flex items-center gap-2">
              <ArrowUpCircle size={14} className="text-success" />
              {pending.length === 1 ? "1 update available" : `${pending.length} updates available`}
            </span>
          ) : (
            <span className="text-muted">
              {updates ? "Everything from Modrinth and CurseForge is up to date." : "Updates weren't checked."}
            </span>
          )}
          <div className="flex-1" />
          <Button variant="ghost" icon={RefreshCw} className="h-7 px-3 text-[12px]" onClick={check} disabled={checking}>
            Check
          </Button>
          {pendingHere.length > 0 && (
            <Button
              variant="primary"
              className="h-7 px-3 text-[12px]"
              disabled={updating.size > 0}
              onClick={() => update(pendingHere)}
            >
              Update all {label.toLowerCase()}
            </Button>
          )}
        </div>

        {items === null ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted">
            <Loader2 size={15} className="animate-spin" /> Loading…
          </p>
        ) : shown.length === 0 ? (
          query ? (
            <p className="py-10 text-center text-[13px] text-muted">Nothing matches “{query}”.</p>
          ) : (
            <EmptyState
              icon={Package}
              title={`No ${label.toLowerCase()} yet`}
              body={
                tab === "mod" && inst.loader === "vanilla"
                  ? "This is a vanilla instance. Mods need Fabric, Quilt, Forge or NeoForge."
                  : "Find something in Browse, or drop files into the folder."
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
                <div key={key} className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-fg/[0.04]">
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
                      {up && <span className="text-success"> → {up.version}</span>}
                      {!i.source && " · added by hand"}
                    </p>
                  </div>
                  {up &&
                    (busy ? (
                      <Badge>
                        <span className="flex items-center gap-1">
                          <Loader2 size={11} className="animate-spin" /> Updating
                        </span>
                      </Badge>
                    ) : (
                      <Button
                        className="h-7 px-3 text-[12px]"
                        icon={ArrowUpCircle}
                        disabled={updating.size > 0}
                        onClick={() => update([up])}
                      >
                        Update
                      </Button>
                    ))}
                  <button
                    aria-label={confirm === key ? "Click again to remove" : `Remove ${i.title}`}
                    title={confirm === key ? "Click again to remove" : "Remove"}
                    onClick={() =>
                      confirm === key
                        ? act(() => api.removeContent(inst.id, i.kind, i.file)).then(() => setConfirm(null))
                        : setConfirm(key)
                    }
                    className="grid h-8 min-w-8 place-items-center rounded-md px-2 text-muted opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    {confirm === key ? <span className="text-[11px] font-semibold">{t("Sure?")}</span> : <Trash2 size={15} />}
                  </button>
                  <Toggle
                    label={`${i.enabled ? "Disable" : "Enable"} ${i.title}`}
                    checked={i.enabled}
                    onChange={(on) => act(() => api.setContentEnabled(inst.id, i.kind, i.file, on))}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
