import { t } from "../i18n";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { api, errorText, loaderLabels, type LoaderKind, type VersionEntry } from "../lib/api";
import { useLauncher } from "../launcher";
import { Dialog, Field, inputClass } from "./Dialog";
import { LoaderVersionSelect } from "./LoaderVersionSelect";
import { Button, Segmented, Toggle, cx } from "./ui";

/** Versions before 1.13, which Ornithe covers. */
function isOld(version: string) {
  const [major, minor] = version.split(".").map(Number);
  return major === 1 && minor < 13;
}

/** Versions before 1.14, where Fabric itself has no builds (only Legacy Fabric). Fabric runs on Ornithe there. */
function isPreFabric(version: string) {
  const [major, minor] = version.split(".").map(Number);
  return major === 1 && minor < 14;
}

const loaderOptions = (Object.keys(loaderLabels) as LoaderKind[]).map((k) => ({
  value: k,
  label: loaderLabels[k],
}));

export function NewInstanceDialog() {
  const { newInstanceOpen, openNewInstance, refresh } = useLauncher();
  const [versions, setVersions] = useState<VersionEntry[] | null>(null);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [snapshots, setSnapshots] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [loader, setLoader] = useState<LoaderKind>("vanilla");
  const [loaderVersion, setLoaderVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<false | "creating" | "client">(false);
  const [performanceMods, setPerformanceMods] = useState(true);
  const [client, setClient] = useState(true);
  // Why Novex Client can't run on the chosen version and loader; undefined while checking.
  const [clientBlocked, setClientBlocked] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!newInstanceOpen) return;
    setName("");
    setQuery("");
    setPerformanceMods(true);
    setClient(true);
    setError(null);
    api
      .versions()
      .then((v) => {
        setVersions(v);
        setSelected((s) => s ?? v.find((x) => x.type === "release")?.id ?? null);
      })
      .catch((e) => setError(errorText(e)));
  }, [newInstanceOpen]);

  const shown = useMemo(
    () =>
      (versions ?? []).filter(
        (v) => (snapshots || v.type === "release") && v.id.toLowerCase().includes(query.toLowerCase()),
      ),
    [versions, snapshots, query],
  );

  // On old versions, Fabric means Ornithe: Fabric Loader for those versions, with the fast stack.
  const fabricOnOrnithe = loader === "fabric" && !!selected && isPreFabric(selected);
  const kind: LoaderKind = fabricOnOrnithe ? "ornithe" : loader;

  useEffect(() => {
    if (!selected || kind === "vanilla") return;
    let alive = true;
    setClientBlocked(undefined);
    api
      .clientUnsupported(selected, kind)
      .then((r) => alive && setClientBlocked(r))
      .catch((e) => alive && setClientBlocked(errorText(e)));
    return () => {
      alive = false;
    };
  }, [selected, kind]);

  const withClient = kind !== "vanilla" && client && clientBlocked === null;

  const create = async () => {
    if (!selected) return;
    setBusy("creating");
    setError(null);
    let made = false;
    try {
      const fallback =
        kind === "vanilla" ? `Minecraft ${selected}` : `${loaderLabels[loader]} ${selected}`;
      const inst = await api.createInstance(
        name.trim() || fallback,
        selected,
        kind,
        kind === "vanilla" ? null : loaderVersion,
        kind === "vanilla" ? null : performanceMods,
      );
      made = true;
      // Turning the client on downloads it and the mods it needs, so it can take a moment.
      if (withClient) {
        setBusy("client");
        await api.clientSetEnabled(inst.id, true);
      }
      await refresh();
      openNewInstance(false);
    } catch (e) {
      // The instance exists even if the client couldn't be set up; it can be turned on later.
      if (made) await refresh();
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={newInstanceOpen}
      onClose={() => openNewInstance(false)}
      title="New instance"
      footer={
        <>
          <Button variant="ghost" onClick={() => openNewInstance(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={create}
            disabled={!selected || !!busy || (loader !== "vanilla" && !loaderVersion)}
          >
            {busy === "client" ? t("Setting up Novex Client…") : busy ? "Creating…" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={selected ? `Minecraft ${selected}` : "My instance"}
            className={inputClass}
          />
        </Field>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted">Version</span>
            <label className="flex items-center gap-2 text-[12px] text-muted">
              Show snapshots & old versions
              <Toggle label="Show snapshots" checked={snapshots} onChange={setSnapshots} />
            </label>
          </div>
          <div className="hairline mb-2 flex h-9 items-center gap-2 rounded-full border bg-raised px-4 focus-within:border-fg/20">
            <Search size={14} className="text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter versions"
              className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted"
            />
          </div>
          <div className="hairline h-56 overflow-y-auto rounded-lg border p-1">
            {!versions && !error && (
              <p className="flex h-full items-center justify-center gap-2 text-[13px] text-muted">
                <Loader2 size={14} className="animate-spin" /> Loading versions…
              </p>
            )}
            {shown.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelected(v.id)}
                className={cx(
                  "flex w-full items-center justify-between rounded px-3 py-1.5 text-left text-[13px] transition",
                  selected === v.id ? "bg-accent text-accent-fg" : "hover:bg-fg/5",
                )}
              >
                <span className="font-medium">{v.id}</span>
                <span className={selected === v.id ? "opacity-80" : "text-muted"}>
                  {v.type.replace("_", " ")} · {v.releaseTime.slice(0, 10)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="block text-[12px] font-medium text-muted">Mod loader</span>
          <Segmented value={loader} onChange={setLoader} options={loaderOptions} />
          {loader === "forge" && selected && isOld(selected) && (
            <button type="button" className="block text-left text-[12px] text-muted hover:text-fg" onClick={() => setLoader("ornithe")}>
              {t("Ornithe runs old versions natively on Java 25, so they're much faster than on Forge, especially on Apple Silicon.")}
            </button>
          )}
          {fabricOnOrnithe && (
            <p className="text-[12px] text-muted">
              {t("On this version, Fabric runs on Ornithe: Fabric Loader for old versions, running natively on Java 25.")}
            </p>
          )}
          {selected && (
            <LoaderVersionSelect
              kind={kind}
              game={selected}
              value={loaderVersion}
              onChange={setLoaderVersion}
            />
          )}
        </div>

        {selected && kind !== "vanilla" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium">{t("Performance mods")}</p>
                <p className="text-[12px] text-muted">
                  {kind === "ornithe"
                    ? t("OneClient's set: Argentum, Sarcio, Slipstream and more. Pylon always installs: old versions need it to open a window.")
                    : t("OneClient's set: Sodium, Lithium, FerriteCore and more, where they support this version.")}
                </p>
              </div>
              <Toggle label={t("Performance mods")} checked={performanceMods} onChange={setPerformanceMods} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium">{t("Novex Client")}</p>
                <p className="text-[12px] text-muted">
                  {clientBlocked === undefined
                    ? t("Checking…")
                    : clientBlocked ?? t("HUD, menu and PvP features. You can change this later on the instance.")}
                </p>
              </div>
              <Toggle
                label={t("Novex Client")}
                checked={withClient}
                disabled={clientBlocked !== null}
                onChange={setClient}
              />
            </div>
          </div>
        )}
        {error && <p className="text-[13px] text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}
