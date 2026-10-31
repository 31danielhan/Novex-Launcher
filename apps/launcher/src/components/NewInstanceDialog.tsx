import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { api, errorText, type VersionEntry } from "../lib/api";
import { useLauncher } from "../launcher";
import { Dialog, Field, inputClass } from "./Dialog";
import { Button, Toggle, cx } from "./ui";

export function NewInstanceDialog() {
  const { newInstanceOpen, openNewInstance, refresh } = useLauncher();
  const [versions, setVersions] = useState<VersionEntry[] | null>(null);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [snapshots, setSnapshots] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!newInstanceOpen) return;
    setName("");
    setQuery("");
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

  const create = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.createInstance(name.trim() || `Minecraft ${selected}`, selected);
      await refresh();
      openNewInstance(false);
    } catch (e) {
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
          <Button variant="primary" onClick={create} disabled={!selected || busy}>
            {busy ? "Creating…" : "Create"}
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
          <div className="hairline mb-2 flex h-9 items-center gap-2 rounded border bg-bg px-3 focus-within:border-accent/60">
            <Search size={14} className="text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter versions"
              className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted"
            />
          </div>
          <div className="hairline h-56 overflow-y-auto rounded border p-1">
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

        <p className="text-[12px] text-muted">Mod loaders (Fabric, Forge, NeoForge, Quilt) are coming next.</p>
        {error && <p className="text-[13px] text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}
