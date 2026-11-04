import { t, tNode } from "../i18n";
import { useCallback, useEffect, useState } from "react";
import { Boxes, Keyboard, LayoutDashboard, Loader2, Plus, Swords } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader, Segmented, Toggle, cx } from "../components/ui";
import { inputClass } from "../components/Dialog";
import { selectedInstance, useLauncher } from "../launcher";
import { api, errorText, inTauri, type ClientStatus, type LoaderKind } from "../lib/api";
import { InstanceSwitcher } from "./Home";

/** Same keys and defaults as Config.java in the mod. `legacy` modules exist only in the 1.8.9 Forge build. */
const modules: { key: string; label: string; on: boolean; legacy?: boolean }[] = [
  { key: "fps", label: "FPS", on: true },
  { key: "cps", label: "CPS", on: true },
  { key: "ping", label: "Ping", on: true },
  { key: "coordinates", label: "Coordinates", on: true },
  { key: "keystrokes", label: "Keystrokes", on: true },
  { key: "armor", label: "Armor status", on: true },
  { key: "effects", label: "Potion effects", on: true },
  { key: "toggleSprint", label: "Toggle sprint", on: false },
  { key: "zoom", label: "Zoom", on: true },
  { key: "motionBlur", label: "Motion blur", on: false },
  { key: "oldBlockHit", label: "1.7 block hit", on: true, legacy: true },
  { key: "oldEating", label: "1.7 eating", on: true, legacy: true },
  { key: "damageTilt", label: "Damage tilt", on: true, legacy: true },
  { key: "fovEffects", label: "FOV effects", on: true, legacy: true },
  { key: "sidebar", label: "Sidebar", on: true, legacy: true },
  { key: "buildLimit", label: "Build height limit", on: true, legacy: true },
];

/** What turning the client on installs with it, matching companions() in client.rs. */
function companions(loader: LoaderKind) {
  if (loader === "fabric" || loader === "quilt") return t("Fabric API and Sodium");
  if (loader === "forge") return t("Embeddium where available");
  return t("Sodium where available");
}

export function ClientScreen() {
  const inst = useLauncher(selectedInstance);
  const { openNewInstance, setError, setNotice } = useLauncher();
  const [status, setStatus] = useState<ClientStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!inst || !inTauri) return setStatus(null);
    api.clientStatus(inst.id).then(setStatus).catch((e) => setError(errorText(e)));
  }, [inst, setError]);
  useEffect(load, [load]);

  if (!inst) {
    return (
      <EmptyState
        icon={Swords}
        title={t("No instances yet")}
        body={t("Novex Client runs on Fabric, Quilt, NeoForge and Forge instances, from 1.8.9 to 26.3.")}
        action={
          <Button variant="primary" icon={Plus} onClick={() => openNewInstance(true)}>
            {t("New instance")}
          </Button>
        }
      />
    );
  }

  const setEnabled = async (on: boolean) => {
    setBusy(true);
    try {
      setStatus(await api.clientSetEnabled(inst.id, on));
      setNotice(t(on ? "Novex Client is on for {name}." : "Novex Client is off for {name}.", { name: inst.name }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const setModule = async (key: string, value: boolean | number) => {
    try {
      setStatus(await api.clientSetModule(inst.id, key, value));
    } catch (e) {
      setError(errorText(e));
    }
  };
  const value = (key: string, fallback: boolean) => {
    const v = status?.modules[key];
    return typeof v === "boolean" ? v : fallback;
  };
  const zoom = String(status?.modules.zoomFactor ?? 4);
  const blur = String(status?.modules.motionBlurLevel ?? 2);
  const buildHeight = Number(status?.modules.buildHeight ?? 255);
  const legacy = inst.loader === "forge" && inst.version === "1.8.9";
  const shown = modules.filter((m) => legacy || !m.legacy);
  const unsupported = status?.unsupported;
  const off = !status?.enabled;

  return (
    <>
      <PageHeader subtitle={t("A HUD mod for your instances, on Fabric, Quilt, NeoForge and Forge. Information only: no reach, hitbox, auto-click or ESP.")} />

      <Card className="relative z-10 mb-4 p-5">
        <InstanceSwitcher current={inst} />
        <div className="mt-3 flex items-center gap-4">
          <div className="slot grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
            <Swords size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="display truncate text-[20px] font-semibold">{inst.name}</p>
            <p className="text-[13px] text-muted">
              {unsupported ??
                (status?.enabled
                  ? t("On for this instance.")
                  : t("Off. Turning it on also installs {mods}.", { mods: companions(inst.loader) }))}
            </p>
          </div>
          {busy && <Loader2 size={16} className="animate-spin text-muted" />}
          <Toggle
            label={t("Novex Client")}
            checked={!!status?.enabled}
            disabled={!status || busy || (!!unsupported && !status.enabled)}
            onChange={setEnabled}
          />
        </div>
        {unsupported && (
          <div className="mt-4">
            <Button icon={Boxes} onClick={() => openNewInstance(true)}>
              {t("New instance")}
            </Button>
          </div>
        )}
      </Card>

      <Card className={cx("mb-4 p-5 transition", off && "opacity-60")}>
        <div className="mb-4 flex items-center gap-2">
          <LayoutDashboard size={16} className="text-muted" />
          <h2 className="display text-[17px] font-semibold">{t("Modules")}</h2>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m) => (
            <div key={m.key} className="slot flex items-center justify-between gap-2 rounded-lg bg-raised px-3.5 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium">
                <span className="truncate">{t(m.label)}</span>
                {m.legacy && <Badge>{t("1.8.9 only")}</Badge>}
              </span>
              <Toggle
                label={t(m.label)}
                checked={value(m.key, m.on)}
                disabled={!status}
                onChange={(v) => setModule(m.key, v)}
              />
            </div>
          ))}
        </div>
        <div className="hairline mt-4 flex items-center justify-between gap-4 border-t pt-4">
          <div>
            <p className="text-[13px] font-medium">{t("Zoom strength")}</p>
            <p className="text-[12px] text-muted">{t("How far holding the zoom key magnifies.")}</p>
          </div>
          <Segmented
            value={zoom}
            disabled={!status}
            onChange={(v) => setModule("zoomFactor", Number(v))}
            options={[
              { value: "2", label: "2×" },
              { value: "4", label: "4×" },
              { value: "8", label: "8×" },
            ]}
          />
        </div>
        <div className="hairline mt-4 flex items-center justify-between gap-4 border-t pt-4">
          <p className="text-[13px] font-medium">{t("Motion blur strength")}</p>
          <Segmented
            value={blur}
            disabled={!status}
            onChange={(v) => setModule("motionBlurLevel", Number(v))}
            options={[
              { value: "1", label: t("Light") },
              { value: "2", label: t("Medium") },
              { value: "3", label: t("Strong") },
            ]}
          />
        </div>
        {legacy && (
          <>
            <div className="hairline mt-4 flex items-center justify-between gap-4 border-t pt-4">
              <div>
                <p className="text-[13px] font-medium">{t("Sidebar numbers")}</p>
                <p className="text-[12px] text-muted">{t("Show the red score numbers on the right of the sidebar.")}</p>
              </div>
              <Toggle
                label={t("Sidebar numbers")}
                checked={value("sidebarNumbers", false)}
                disabled={!status}
                onChange={(v) => setModule("sidebarNumbers", v)}
              />
            </div>
            <div className="hairline mt-4 flex items-center justify-between gap-4 border-t pt-4">
              <div>
                <p className="text-[13px] font-medium">{t("Build height")}</p>
                <p className="text-[12px] text-muted">{t("Highest Y you can place blocks at. Hypixel maps often use lower limits.")}</p>
              </div>
              <input
                key={buildHeight}
                type="number"
                min={1}
                max={255}
                defaultValue={buildHeight}
                disabled={!status}
                aria-label={t("Build height")}
                onBlur={(e) => {
                  const v = Math.round(Number(e.target.value));
                  if (v >= 1 && v <= 255 && v !== buildHeight) setModule("buildHeight", v);
                }}
                className={`${inputClass} w-24 text-right`}
              />
            </div>
          </>
        )}
        <p className="mt-3 text-[12px] text-muted">{t("Changes here apply the next time the game starts.")}</p>
      </Card>

      <Card className="flex items-center gap-4 p-5">
        <Keyboard size={18} className="shrink-0 text-muted" />
        <p className="text-[13px] text-muted">
          {tNode(
            "In game or on any menu, press {menu} to move and resize the HUD; its Settings button opens the modules. Hold {zoom} to zoom. The title screen has a Novex Client button too.",
            { menu: <Kbd>{t("Right Shift")}</Kbd>, zoom: <Kbd>C</Kbd> },
          )}
        </p>
      </Card>
    </>
  );
}

function Kbd({ children }: { children: string }) {
  return <kbd className="slot rounded bg-raised px-1.5 py-0.5 font-sans text-[12px] font-medium text-fg">{children}</kbd>;
}
