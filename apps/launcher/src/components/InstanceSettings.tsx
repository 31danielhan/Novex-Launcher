import { t } from "../i18n";
import { useEffect, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { api, errorText, inTauri, loaderLabels, type Instance, type InstancePatch } from "../lib/api";
import { useLauncher } from "../launcher";
import { Field, inputClass } from "./Dialog";
import { LoaderVersionSelect } from "./LoaderVersionSelect";
import { Button, Card, Toggle } from "./ui";

const EMPTY: InstancePatch = {
  name: "",
  loaderVersion: null,
  memoryMb: null,
  javaPath: null,
  jvmArgs: null,
  useGameOptions: true,
};

/** Name, loader, memory and Java for one instance, plus duplicating or deleting it. */
export function InstanceSettings({ inst }: { inst: Instance }) {
  const { refresh, setNotice } = useLauncher();
  const [patch, setPatch] = useState<InstancePatch>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Older instances never chose: their performance mods come with Novex Client, and always on Ornithe.
  const [clientOn, setClientOn] = useState(false);
  useEffect(() => {
    if (inst.performanceMods == null && inTauri) api.clientStatus(inst.id).then((s) => setClientOn(s.enabled)).catch(() => {});
  }, [inst.id, inst.performanceMods]);
  const performanceMods = patch.performanceMods ?? inst.performanceMods ?? (inst.loader === "ornithe" || clientOn);

  useEffect(() => {
    setError(null);
    setPatch({
      name: inst.name,
      loaderVersion: inst.loaderVersion ?? null,
      memoryMb: inst.memoryMb ?? null,
      javaPath: inst.javaPath ?? null,
      jvmArgs: inst.jvmArgs ?? null,
      useGameOptions: inst.useGameOptions !== false,
    });
    // Reset only when a different instance opens, not on every list refresh.
  }, [inst.id]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const set = (p: Partial<InstancePatch>) => setPatch((s) => ({ ...s, ...p }));
  const memory = patch.memoryMb ?? 4096;

  return (
    <Card className="p-5">
      <div className="space-y-4">
        <Field label="Name">
          <input value={patch.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
        </Field>

        {inst.loader !== "vanilla" && (
          <Field label={`${loaderLabels[inst.loader]} version (Minecraft ${inst.version})`}>
            <LoaderVersionSelect
              kind={inst.loader}
              game={inst.version}
              value={patch.loaderVersion}
              onChange={(v) => set({ loaderVersion: v })}
            />
          </Field>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted">Custom memory</span>
            <Toggle
              label="Custom memory"
              checked={patch.memoryMb !== null}
              onChange={(on) => set({ memoryMb: on ? memory : null })}
            />
          </div>
          {patch.memoryMb !== null ? (
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1024}
                max={16384}
                step={512}
                value={memory}
                onChange={(e) => set({ memoryMb: Number(e.target.value) })}
                className="flex-1 accent-[rgb(var(--accent))]"
                aria-label="Memory"
              />
              <span className="w-14 text-right text-[13px] font-medium">
                {(memory / 1024).toFixed(1).replace(/\.0$/, "")} GB
              </span>
            </div>
          ) : (
            <p className="text-[12px] text-muted">Uses the global setting.</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium text-muted">{t("Use the launcher's game settings")}</p>
            <p className="text-[12px] text-muted">{t("Off keeps this instance's own options as they are.")}</p>
          </div>
          <Toggle
            label={t("Use the launcher's game settings")}
            checked={patch.useGameOptions !== false}
            onChange={(on) => set({ useGameOptions: on })}
          />
        </div>

        {inst.loader !== "vanilla" && (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[12px] font-medium text-muted">{t("Performance mods")}</p>
              <p className="text-[12px] text-muted">
                {t("OneClient's set, installed on the next launch. Turning this off doesn't remove ones already installed.")}
              </p>
            </div>
            <Toggle
              label={t("Performance mods")}
              checked={performanceMods}
              onChange={(on) => set({ performanceMods: on })}
            />
          </div>
        )}

        <Field label="Java executable">
          <input
            value={patch.javaPath ?? ""}
            onChange={(e) => set({ javaPath: e.target.value || null })}
            placeholder="Global setting"
            className={inputClass}
            spellCheck={false}
          />
        </Field>
        <Field label="JVM arguments">
          <input
            value={patch.jvmArgs ?? ""}
            onChange={(e) => set({ jvmArgs: e.target.value || null })}
            placeholder="Global setting"
            className={`${inputClass} font-mono`}
            spellCheck={false}
          />
        </Field>

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <div className="flex items-center gap-2 pt-2">
          <Button variant="ghost" icon={Copy} disabled={busy} onClick={() => run(() => api.cloneInstance(inst.id))}>
            Duplicate
          </Button>
          <Button
            variant="ghost"
            icon={Trash2}
            disabled={busy}
            onClick={() => (confirmDelete ? run(() => api.deleteInstance(inst.id)) : setConfirmDelete(true))}
            onBlur={() => setConfirmDelete(false)}
            title={t(confirmDelete ? "Click again to delete" : "Delete")}
          >
            {confirmDelete ? t("Sure?") : t("Delete")}
          </Button>
          <div className="flex-1" />
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => run(() => api.updateInstance(inst.id, patch)).then(() => setNotice("Saved."))}
          >
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
}
