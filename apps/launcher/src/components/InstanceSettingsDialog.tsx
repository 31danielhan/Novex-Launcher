import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { api, errorText, loaderLabels, type InstancePatch } from "../lib/api";
import { useLauncher } from "../launcher";
import { Dialog, Field, inputClass } from "./Dialog";
import { LoaderVersionSelect } from "./LoaderVersionSelect";
import { Button, Toggle } from "./ui";

const EMPTY: InstancePatch = {
  name: "",
  loaderVersion: null,
  memoryMb: null,
  javaPath: null,
  jvmArgs: null,
};

export function InstanceSettingsDialog() {
  const { settingsFor, openInstanceSettings, instances, refresh } = useLauncher();
  const inst = instances.find((i) => i.id === settingsFor);
  const [patch, setPatch] = useState<InstancePatch>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!inst) return;
    setError(null);
    setPatch({
      name: inst.name,
      loaderVersion: inst.loaderVersion ?? null,
      memoryMb: inst.memoryMb ?? null,
      javaPath: inst.javaPath ?? null,
      jvmArgs: inst.jvmArgs ?? null,
    });
    // Reset only when a different instance opens, not on every list refresh.
  }, [settingsFor]);

  const close = () => openInstanceSettings(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!inst) return null;
  const set = (p: Partial<InstancePatch>) => setPatch((s) => ({ ...s, ...p }));
  const memory = patch.memoryMb ?? 4096;

  return (
    <Dialog
      open
      onClose={close}
      title="Instance settings"
      footer={
        <>
          <Button variant="ghost" icon={Copy} disabled={busy} onClick={() => run(() => api.cloneInstance(inst.id))}>
            Duplicate
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => run(() => api.updateInstance(inst.id, patch))}>
            Save
          </Button>
        </>
      }
    >
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
      </div>
    </Dialog>
  );
}
