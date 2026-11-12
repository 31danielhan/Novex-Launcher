import { t } from "../i18n";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronLeft, Loader2, Search } from "lucide-react";
import { api, errorText, loaderLabels, type LoaderKind, type VersionEntry } from "../lib/api";
import { useLauncher } from "../launcher";
import { Dialog, Field, inputClass } from "./Dialog";
import { LoaderVersionSelect } from "./LoaderVersionSelect";
import { Button, Toggle, cx } from "./ui";

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

const loaderKinds = Object.keys(loaderLabels) as LoaderKind[];

/** One line on each loader, shown on its card. */
const loaderAbout: Record<LoaderKind, string> = {
  vanilla: "The game as Mojang ships it, no mods.",
  fabric: "Light and fast. Most performance and client mods.",
  quilt: "A Fabric fork that runs most Fabric mods.",
  ornithe: "Fabric for old versions, natively on Java 25.",
  forge: "The classic loader for big content mods.",
  neoforge: "Forge's modern successor for newer versions.",
};

export function NewInstanceDialog() {
  const { newInstanceOpen, openNewInstance, refresh } = useLauncher();
  const [versions, setVersions] = useState<VersionEntry[] | null>(null);
  const [step, setStep] = useState(0);
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
    setStep(0);
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
  const canCreate = loader === "vanilla" || !!loaderVersion;

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

  const steps = [t("Version"), t("Loader"), t("Extras"), t("Finish")];
  // Vanilla has nothing to add, so it skips the extras page.
  const skipExtras = kind === "vanilla";
  const next = (s: number) => (s === 1 && skipExtras ? 3 : s + 1);
  const back = (s: number) => (s === 3 && skipExtras ? 1 : s - 1);
  const canNext =
    step === 0 ? !!selected : step === 1 ? loader === "vanilla" || !!loaderVersion : true;
  const fallbackName = selected
    ? kind === "vanilla"
      ? `Minecraft ${selected}`
      : `${loaderLabels[loader]} ${selected}`
    : t("My instance");

  return (
    <Dialog
      open={newInstanceOpen}
      onClose={() => openNewInstance(false)}
      title={t("New instance")}
      wide
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-[12px] text-muted">
            {t("Step {n} of {total}", { n: step + 1, total: steps.length })}
          </span>
          <div className="flex gap-2">
            {step === 0 ? (
              <Button variant="ghost" onClick={() => openNewInstance(false)}>
                {t("Cancel")}
              </Button>
            ) : (
              <Button variant="ghost" icon={ChevronLeft} disabled={!!busy} onClick={() => setStep(back)}>
                {t("Back")}
              </Button>
            )}
            {step < 3 ? (
              <Button variant="primary" disabled={!canNext} onClick={() => setStep(next)}>
                {t("Next")}
              </Button>
            ) : (
              <Button variant="primary" onClick={create} disabled={!selected || !!busy || !canCreate}>
                {busy === "client" ? t("Setting up Novex Client…") : busy ? t("Creating…") : t("Create")}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <ol className="mb-5 flex items-center gap-2">
        {steps.map((label, i) => {
          const skipped = i === 2 && skipExtras;
          const done = i < step && !skipped;
          const reachable = i < step && !skipped && !busy;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => setStep(i)}
                className={cx(
                  "flex items-center gap-2 text-[12px] font-medium transition",
                  i === step ? "text-fg" : "text-muted",
                  skipped && "opacity-40",
                  reachable && "hover:text-fg",
                )}
              >
                <span
                  className={cx(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] transition",
                    i === step || done ? "bg-accent text-accent-fg" : "hairline border",
                  )}
                >
                  {done ? <Check size={12} /> : i + 1}
                </span>
                {label}
              </button>
              {i < steps.length - 1 && <span className="hairline h-px flex-1 border-t" />}
            </li>
          );
        })}
      </ol>

      <div key={step} className="min-h-[340px] animate-[fade_160ms_ease-out] space-y-4">
        {step === 0 && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="hairline flex h-9 flex-1 items-center gap-2 rounded-full border bg-raised px-4 focus-within:border-fg/20">
                <Search size={14} className="text-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("Filter versions")}
                  className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted"
                />
              </div>
              <label className="flex shrink-0 items-center gap-2 text-[12px] text-muted">
                {t("Show snapshots & old versions")}
                <Toggle label={t("Show snapshots")} checked={snapshots} onChange={setSnapshots} />
              </label>
            </div>
            <div className="hairline h-72 overflow-y-auto rounded-lg border p-1">
              {!versions && !error && (
                <p className="flex h-full items-center justify-center gap-2 text-[13px] text-muted">
                  <Loader2 size={14} className="animate-spin" /> {t("Loading versions…")}
                </p>
              )}
              {versions && shown.length === 0 && (
                <p className="flex h-full items-center justify-center text-[13px] text-muted">
                  {t("No versions match.")}
                </p>
              )}
              {shown.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelected(v.id)}
                  onDoubleClick={() => {
                    setSelected(v.id);
                    setStep(1);
                  }}
                  className={cx(
                    "flex w-full items-center justify-between rounded px-3 py-1.5 text-left text-[13px] transition",
                    selected === v.id ? "bg-accent text-accent-fg" : "hover:bg-fg/5",
                  )}
                >
                  <span className="font-medium">{v.id}</span>
                  <span className={selected === v.id ? "opacity-80" : "text-muted"}>
                    {t(v.type.replace("_", " "))} · {v.releaseTime.slice(0, 10)}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && selected && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {loaderKinds.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setLoader(k)}
                  className={cx(
                    "hairline rounded-xl border p-3 text-left transition",
                    loader === k ? "border-accent bg-accent/10 ring-1 ring-accent" : "hover:bg-fg/5",
                  )}
                >
                  <span className="flex items-center justify-between text-[13px] font-semibold">
                    {t(loaderLabels[k])}
                    {loader === k && <Check size={14} className="text-accent" />}
                  </span>
                  <span className="mt-1 block text-[12px] leading-snug text-muted">{t(loaderAbout[k])}</span>
                </button>
              ))}
            </div>
            {loader === "forge" && isOld(selected) && (
              <button type="button" className="block text-left text-[12px] text-muted hover:text-fg" onClick={() => setLoader("ornithe")}>
                {t("Ornithe runs old versions natively on Java 25, so they're much faster than on Forge, especially on Apple Silicon.")}
              </button>
            )}
            {fabricOnOrnithe && (
              <p className="text-[12px] text-muted">
                {t("On this version, Fabric runs on Ornithe: Fabric Loader for old versions, running natively on Java 25.")}
              </p>
            )}
            {kind !== "vanilla" && (
              <div>
                <span className="mb-1.5 block text-[12px] font-medium text-muted">{t("Loader version")}</span>
                <LoaderVersionSelect kind={kind} game={selected} value={loaderVersion} onChange={setLoaderVersion} />
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <Option
              title={t("Performance mods")}
              about={
                kind === "ornithe"
                  ? t("OneClient's set: Argentum, Sarcio, Slipstream and more. Pylon always installs: old versions need it to open a window.")
                  : t("OneClient's set: Sodium, Lithium, FerriteCore and more, where they support this version.")
              }
            >
              <Toggle label={t("Performance mods")} checked={performanceMods} onChange={setPerformanceMods} />
            </Option>
            <Option
              title={t("Novex Client")}
              about={
                clientBlocked === undefined
                  ? t("Checking…")
                  : clientBlocked ?? t("HUD, menu and PvP features. You can change this later on the instance.")
              }
            >
              <Toggle label={t("Novex Client")} checked={withClient} disabled={clientBlocked !== null} onChange={setClient} />
            </Option>
          </div>
        )}

        {step === 3 && (
          <>
            <Field label={t("Name")}>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canCreate && !busy && create()}
                placeholder={fallbackName}
                className={inputClass}
              />
            </Field>
            <div className="hairline divide-y divide-fg/5 rounded-xl border">
              <Summary label={t("Version")} value={selected ?? "—"} onEdit={busy ? undefined : () => setStep(0)} />
              <Summary
                label={t("Loader")}
                value={kind === "vanilla" ? t("Vanilla") : `${t(loaderLabels[kind])} ${loaderVersion ?? ""}`}
                onEdit={busy ? undefined : () => setStep(1)}
              />
              {!skipExtras && (
                <>
                  <Summary
                    label={t("Performance mods")}
                    value={performanceMods ? t("On") : t("Off")}
                    onEdit={busy ? undefined : () => setStep(2)}
                  />
                  <Summary
                    label={t("Novex Client")}
                    value={withClient ? t("On") : t("Off")}
                    onEdit={busy ? undefined : () => setStep(2)}
                  />
                </>
              )}
            </div>
          </>
        )}
        {error && <p className="text-[13px] text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}

function Option({ title, about, children }: { title: string; about: string; children: ReactNode }) {
  return (
    <div className="hairline flex items-center justify-between gap-4 rounded-xl border p-4">
      <div>
        <p className="text-[13px] font-medium">{title}</p>
        <p className="mt-0.5 text-[12px] text-muted">{about}</p>
      </div>
      {children}
    </div>
  );
}

function Summary({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-[13px]">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-3">
        <span className="font-medium">{value}</span>
        {onEdit && (
          <button type="button" onClick={onEdit} className="text-[12px] text-accent hover:underline">
            {t("Change")}
          </button>
        )}
      </span>
    </div>
  );
}
