import { useCallback, useEffect, useState } from "react";
import { Package, Plus, Trash2 } from "lucide-react";
import { api, errorText, type ContentKind, type InstalledItem } from "../lib/api";
import { useLauncher } from "../launcher";
import { useApp } from "../store";
import { Dialog } from "./Dialog";
import { Button, EmptyState, Segmented, Toggle } from "./ui";

type Tab = Exclude<ContentKind, "modpack">;

const tabs: { value: Tab; label: string }[] = [
  { value: "mod", label: "Mods" },
  { value: "resourcepack", label: "Resource packs" },
  { value: "shader", label: "Shaders" },
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
      className="grid shrink-0 place-items-center rounded-lg bg-raised font-semibold uppercase text-muted"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {title[0] ?? "?"}
    </div>
  );
}

export function ContentDialog() {
  const { contentFor, openContent, instances, setBrowseTarget } = useLauncher();
  const setScreen = useApp((s) => s.setScreen);
  const inst = instances.find((i) => i.id === contentFor);
  const [tab, setTab] = useState<Tab>("mod");
  const [items, setItems] = useState<InstalledItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!contentFor) return;
    try {
      setItems(await api.installedContent(contentFor));
    } catch (e) {
      setError(errorText(e));
    }
  }, [contentFor]);

  useEffect(() => {
    setItems(null);
    setError(null);
    setTab("mod");
    load();
  }, [load]);

  if (!inst) return null;
  const close = () => openContent(null);
  const shown = items?.filter((i) => i.kind === tab) ?? [];
  const count = (k: Tab) => items?.filter((i) => i.kind === k).length ?? 0;

  const act = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    }
    load();
  };

  const browse = () => {
    setBrowseTarget(inst.id);
    setScreen("browse");
    close();
  };

  return (
    <Dialog
      open
      wide
      onClose={close}
      title={`${inst.name} · Content`}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
          <Button variant="primary" icon={Plus} onClick={browse}>
            Add content
          </Button>
        </>
      }
    >
      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={tabs.map((t) => ({ value: t.value, label: `${t.label} ${count(t.value) || ""}`.trim() }))}
        />
      </div>
      {error && <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2.5 text-[13px] text-danger">{error}</p>}
      {items && shown.length === 0 ? (
        <EmptyState
          icon={Package}
          title={`No ${tabs.find((t) => t.value === tab)?.label.toLowerCase()} yet`}
          body="Find something in Browse, or drop files into the instance folder."
          action={<Button icon={Plus} onClick={browse}>Browse</Button>}
        />
      ) : (
        <div className="-mx-2 flex min-h-40 flex-col">
          {shown.map((i) => {
            const key = `${i.kind}/${i.file}`;
            return (
              <div key={key} className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-raised">
                <ProjectIcon url={i.iconUrl} title={i.title} />
                <div className="min-w-0 flex-1">
                  <p className={i.enabled ? "truncate text-[13px] font-medium" : "truncate text-[13px] font-medium text-muted line-through"}>
                    {i.title}
                  </p>
                  <p className="truncate text-[11px] text-muted">{i.version ?? i.file}</p>
                </div>
                <button
                  aria-label={confirm === key ? "Click again to remove" : `Remove ${i.title}`}
                  title={confirm === key ? "Click again to remove" : "Remove"}
                  onClick={() =>
                    confirm === key
                      ? act(() => api.removeContent(inst.id, i.kind, i.file)).then(() => setConfirm(null))
                      : setConfirm(key)
                  }
                  className="grid h-8 min-w-8 place-items-center rounded-full px-2 text-muted opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                >
                  {confirm === key ? <span className="text-[11px] font-semibold">Sure?</span> : <Trash2 size={15} />}
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
    </Dialog>
  );
}
