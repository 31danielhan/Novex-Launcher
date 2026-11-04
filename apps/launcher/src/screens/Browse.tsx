import { t } from "../i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Compass, Download, ExternalLink, Loader2, Search } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  api,
  compactNumber,
  describe,
  errorText,
  inTauri,
  type ContentKind,
  type ContentVersion,
  type Instance,
  type SearchHit,
  type Source,
} from "../lib/api";
import { useLauncher } from "../launcher";
import { Dialog, inputClass } from "../components/Dialog";
import { ProjectIcon } from "../components/InstancePage";
import { Badge, Button, EmptyState, PageHeader, Segmented, cx } from "../components/ui";

const kinds: { value: ContentKind; label: string }[] = [
  { value: "modpack", label: "Modpacks" },
  { value: "mod", label: "Mods" },
  { value: "resourcepack", label: "Resource packs" },
  { value: "shader", label: "Shaders" },
];

const sourceLabel: Record<Source, string> = { modrinth: "Modrinth", curseforge: "CurseForge" };

const key = (source: Source, id: string) => `${source}:${id}`;

/** Installs a project: modpacks become new instances, everything else goes into `target`. */
function useInstall(target: Instance | undefined, onInstalled: () => void) {
  const { installModpack, setError, setNotice } = useLauncher();
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const install = async (hit: SearchHit, kind: ContentKind, versionId: string | null = null) => {
    const k = key(hit.source, hit.id);
    setBusy((b) => new Set(b).add(k));
    try {
      if (kind === "modpack") {
        await installModpack(hit.source, hit.id, versionId, hit.title);
      } else if (target) {
        const names = await api.installContent(target.id, hit.source, hit.id, kind, versionId);
        const extra = names.length > 1 ? ` with ${names.slice(1).join(", ")}` : "";
        setNotice(`Installed ${hit.title}${extra} in ${target.name}.`);
        onInstalled();
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(k);
        return n;
      });
    }
  };
  return { install, busy };
}

function ProjectDialog({
  hit,
  kind,
  target,
  installed,
  onClose,
  install,
}: {
  hit: SearchHit;
  kind: ContentKind;
  target: Instance | undefined;
  installed: boolean;
  onClose: () => void;
  install: (hit: SearchHit, kind: ContentKind, versionId: string | null) => Promise<void>;
}) {
  const [versions, setVersions] = useState<ContentVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const targetId = kind === "modpack" ? null : (target?.id ?? null);
    api
      .contentVersions(hit.source, hit.id, kind, targetId)
      .then(setVersions)
      .catch((e) => setError(errorText(e)));
  }, [hit, kind, target]);

  const pick = async (v: ContentVersion) => {
    setBusy(v.id);
    await install(hit, kind, v.id);
    setBusy(null);
    onClose();
  };

  return (
    <Dialog open wide onClose={onClose} title={hit.title}>
      <div className="mb-5 flex gap-4">
        <ProjectIcon url={hit.iconUrl} title={hit.title} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-muted">
            by {hit.author} · {compactNumber(hit.downloads)} downloads · {sourceLabel[hit.source]}
            {installed && " · Installed"}
          </p>
          <p className="mt-1 text-[13px]">{hit.description}</p>
          <button
            onClick={() => openUrl(hit.url)}
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-muted hover:text-fg"
          >
            Open on {sourceLabel[hit.source]} <ExternalLink size={12} />
          </button>
        </div>
      </div>

      <h3 className="mb-2 text-[13px] font-semibold">
        {kind === "modpack"
          ? "Versions"
          : target
            ? `Versions for ${describe(target)}`
            : "Versions"}
      </h3>
      {error && <p className="rounded-lg bg-danger/10 px-3 py-2.5 text-[13px] text-danger">{error}</p>}
      {!versions && !error && (
        <div className="grid h-32 place-items-center text-muted">
          <Loader2 size={18} className="animate-spin" />
        </div>
      )}
      {versions?.length === 0 && (
        <p className="rounded-lg bg-raised px-4 py-6 text-center text-[13px] text-muted">
          No version of {hit.title} works with this instance.
        </p>
      )}
      <div className="-mx-2 flex flex-col">
        {versions?.slice(0, 30).map((v) => (
          <div key={v.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-raised">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{v.versionNumber}</p>
              <p className="truncate text-[11px] text-muted">
                {[...v.loaders, ...v.gameVersions.slice(-3)].join(" · ")} ·{" "}
                {new Date(v.published).toLocaleDateString()}
              </p>
            </div>
            {v.channel !== "release" && <Badge>{v.channel}</Badge>}
            <Button
              className="h-8"
              disabled={busy !== null || (kind !== "modpack" && !target) || !v.file.url}
              title={v.file.url ? undefined : "The author only allows downloads from CurseForge's website"}
              onClick={() => pick(v)}
            >
              {busy === v.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {t("Install")}
            </Button>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function ResultCard({
  hit,
  state,
  onOpen,
  onInstall,
  disabled,
}: {
  hit: SearchHit;
  state: "idle" | "busy" | "installed";
  onOpen: () => void;
  onInstall: () => void;
  disabled: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="hairline shadow-card flex cursor-pointer gap-4 lift-card rounded-xl border bg-surface p-4"
    >
      <ProjectIcon url={hit.iconUrl} title={hit.title} size={56} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate font-semibold">{hit.title}</p>
          <p className="shrink-0 truncate text-[12px] text-muted">by {hit.author}</p>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted">{hit.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted">
            <Download size={11} />
            {compactNumber(hit.downloads)}
          </span>
          {hit.categories.slice(0, 3).map((c) => (
            <Badge key={c}>{c}</Badge>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-start">
        {state === "installed" ? (
          <Badge tone="success">
            <span className="inline-flex items-center gap-1">
              <Check size={11} />
              {t("Installed")}
            </span>
          </Badge>
        ) : (
          <Button
            variant="primary"
            className="h-8 px-3.5"
            disabled={disabled || state === "busy"}
            onClick={(e) => {
              e.stopPropagation();
              onInstall();
            }}
          >
            {state === "busy" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {t("Install")}
          </Button>
        )}
      </div>
    </div>
  );
}

export function BrowseScreen() {
  const { instances, browseTarget, setBrowseTarget, pack } = useLauncher();
  const [source, setSource] = useState<Source>("modrinth");
  const [kind, setKind] = useState<ContentKind>("modpack");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [curseforge, setCurseforge] = useState(false);
  const [open, setOpen] = useState<SearchHit | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const request = useRef(0);

  const target = instances.find((i) => i.id === browseTarget) ?? instances[0];
  const forInstance = kind !== "modpack";

  useEffect(() => {
    if (inTauri) api.contentSources().then((s) => setCurseforge(s.curseforge)).catch(() => {});
  }, []);

  const loadInstalled = useCallback(() => {
    if (!target || !inTauri) return setInstalled(new Set());
    api
      .installedContent(target.id)
      .then((items) =>
        setInstalled(new Set(items.filter((i) => i.source && i.projectId).map((i) => key(i.source!, i.projectId!)))),
      )
      .catch(() => setInstalled(new Set()));
  }, [target]);
  useEffect(loadInstalled, [loadInstalled]);

  const { install, busy } = useInstall(target, loadInstalled);

  // Keyed on the values, not the instance object, so list refreshes don't re-run the search.
  const [gameVersion, loader] = [target?.version ?? null, target?.loader ?? null];
  const filters = useMemo(
    () =>
      forInstance && gameVersion
        ? { gameVersion, loader: loader === "vanilla" ? null : loader }
        : { gameVersion: null, loader: null },
    [forInstance, gameVersion, loader],
  );

  const run = useCallback(
    async (offset: number) => {
      const id = ++request.current;
      setLoading(true);
      setError(null);
      try {
        const page = await api.search({ source, kind, query, offset, ...filters });
        if (id !== request.current) return;
        setHits((h) => (offset === 0 ? page.hits : [...h, ...page.hits]));
        setTotal(page.total);
      } catch (e) {
        if (id !== request.current) return;
        if (offset === 0) setHits([]);
        setError(errorText(e));
      } finally {
        if (id === request.current) setLoading(false);
      }
    },
    [source, kind, query, filters],
  );

  // Debounced search whenever the query or filters change.
  useEffect(() => {
    const t = setTimeout(() => run(0), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [run, query]);

  const vanillaMods = forInstance && kind === "mod" && target?.loader === "vanilla";
  const needsInstance = forInstance && !target;

  return (
    <>
      <PageHeader
        subtitle={t("Find modpacks, mods, resource packs and shaders.")}
        actions={
          <Segmented<Source>
            value={source}
            onChange={setSource}
            options={[
              { value: "modrinth", label: "Modrinth" },
              { value: "curseforge", label: curseforge ? "CurseForge" : "CurseForge (no key)" },
            ]}
          />
        }
      />

      <div className="hairline shadow-card mb-3 flex h-11 items-center gap-2 rounded-full border bg-surface px-4 focus-within:border-fg/20">
        <Search size={16} className="text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${kinds.find((k) => k.value === kind)?.label.toLowerCase()} on ${sourceLabel[source]}…`}
          className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted"
        />
        {loading && <Loader2 size={15} className="animate-spin text-muted" />}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {kinds.map((k) => (
          <button
            key={k.value}
            onClick={() => setKind(k.value)}
            className={cx(
              "h-8 rounded-full px-3.5 text-[12px] font-medium transition",
              k.value === kind ? "bg-accent text-accent-fg" : "hairline border bg-surface text-muted hover:text-fg",
            )}
          >
            {t(k.label)}
          </button>
        ))}
        <div className="flex-1" />
        {forInstance && instances.length > 0 && (
          <label className="flex items-center gap-2 whitespace-nowrap text-[12px] text-muted">
            Install to
            <select
              value={target?.id}
              onChange={(e) => setBrowseTarget(e.target.value)}
              className={`${inputClass} h-8 w-56 appearance-auto`}
            >
              {instances.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} · {describe(i)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {vanillaMods && (
        <p className="mb-4 rounded-xl bg-raised px-4 py-3 text-[13px] text-muted">
          {target!.name} is a vanilla instance. Pick an instance with a mod loader to install mods.
        </p>
      )}

      {error ? (
        <EmptyState icon={Compass} title={t("Couldn't search")} body={error} />
      ) : needsInstance ? (
        <EmptyState icon={Compass} title={t("No instance to install into")} body={t("Create an instance first, or install a modpack.")} />
      ) : hits.length === 0 && !loading ? (
        <EmptyState icon={Search} title={t("No results")} body={t("Try a different search.")} />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {hits.map((h) => {
            const k = key(h.source, h.id);
            return (
              <ResultCard
                key={k}
                hit={h}
                state={busy.has(k) ? "busy" : forInstance && installed.has(k) ? "installed" : "idle"}
                disabled={vanillaMods || (kind === "modpack" && !!pack)}
                onOpen={() => setOpen(h)}
                onInstall={() => install(h, kind)}
              />
            );
          })}
        </div>
      )}

      {hits.length > 0 && hits.length < total && (
        <div className="mt-5 flex justify-center">
          <Button onClick={() => run(hits.length)} disabled={loading}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            Load more
          </Button>
        </div>
      )}

      {open && (
        <ProjectDialog
          hit={open}
          kind={kind}
          target={target}
          installed={installed.has(key(open.source, open.id))}
          onClose={() => setOpen(null)}
          install={install}
        />
      )}
    </>
  );
}
