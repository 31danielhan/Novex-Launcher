import { t, tNode } from "../i18n";
import { useCallback, useEffect, useState } from "react";
import { Boxes, Download, Keyboard, Loader2, Plus, RefreshCw, Square, Swords, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader } from "../components/ui";
import { InstanceIcon } from "../components/InstanceCard";
import { statusOf, useLauncher } from "../launcher";
import { api, describe, errorText, inTauri, type ClientStatus, type Instance, type LoaderKind } from "../lib/api";
import { OptionTabs } from "./GameSettings";

/** What installing the client adds with it, matching companions() in client.rs. With the
 * performance mods turned off, only what's needed comes along. */
export function companions(loader: LoaderKind, performanceMods: boolean | null = null) {
  if (performanceMods === false) {
    if (loader === "fabric" || loader === "quilt") return t("Fabric API");
    if (loader === "ornithe") return t("Pylon");
    return null;
  }
  if (loader === "fabric" || loader === "quilt") return t("Fabric API, Sodium and other performance mods");
  if (loader === "ornithe") return t("Pylon and other performance mods");
  if (loader === "forge") return t("Embeddium and other performance mods where available");
  return t("Sodium and other performance mods where available");
}

function ClientRow({ inst }: { inst: Instance }) {
  const { setError, kill } = useLauncher();
  const state = useLauncher((s) => statusOf(s.status, inst.id).state);
  const [status, setStatus] = useState<ClientStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (inTauri) api.clientStatus(inst.id).then(setStatus).catch((e) => setError(errorText(e)));
  }, [inst.id, setError]);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<ClientStatus>) => {
    setBusy(true);
    try {
      setStatus(await fn());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const installed = !!status?.enabled;
  const stopped = state === "idle";
  const small = "h-8 px-3 text-[12px]";

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-fg/[0.04]">
      <InstanceIcon inst={inst} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{inst.name}</p>
        <p className="truncate text-[12px] text-muted" title={status?.unsupported ?? undefined}>
          {status?.unsupported && !installed
            ? status.unsupported
            : installed
              ? describe(inst)
              : (() => {
                  const mods = companions(inst.loader, inst.performanceMods ?? null);
                  return mods ? t("Also installs {mods}.", { mods }) : describe(inst);
                })()}
        </p>
      </div>
      {busy && <Loader2 size={15} className="animate-spin text-muted" />}
      {state === "running" && <Badge tone="success">{t("Running")}</Badge>}
      {status?.outdated ? (
        <Badge tone="success">{t("Update available")}</Badge>
      ) : (
        installed && <Badge>{t("Installed")}</Badge>
      )}
      {state === "running" && (
        <Button icon={Square} className={small} onClick={() => kill(inst.id)}>
          {t("Close")}
        </Button>
      )}
      {status?.outdated && (
        <Button
          variant="primary"
          icon={RefreshCw}
          className={small}
          disabled={busy || !stopped}
          onClick={() => run(() => api.clientUpdate(inst.id))}
        >
          {t("Update")}
        </Button>
      )}
      {installed ? (
        <Button
          icon={Trash2}
          className={small}
          disabled={busy || !stopped}
          onClick={() => run(() => api.clientSetEnabled(inst.id, false))}
        >
          {t("Uninstall")}
        </Button>
      ) : (
        !status?.unsupported && (
          <Button
            variant="primary"
            icon={Download}
            className={small}
            disabled={!status || busy || !stopped}
            onClick={() => run(() => api.clientSetEnabled(inst.id, true))}
          >
            {t("Install")}
          </Button>
        )
      )}
    </div>
  );
}

export function ClientScreen() {
  const { instances, openNewInstance } = useLauncher();

  if (!instances.length) {
    return (
      <EmptyState
        icon={Swords}
        title={t("No instances yet")}
        body={t("Novex Client runs on Fabric, Quilt, Ornithe, NeoForge and Forge instances, from 1.8.9 to 26.3.")}
        action={
          <Button variant="primary" icon={Plus} onClick={() => openNewInstance(true)}>
            {t("New instance")}
          </Button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader subtitle={t("A HUD mod for your instances, on Fabric, Quilt, Ornithe, NeoForge and Forge. Information only: no reach, hitbox, auto-click or ESP.")} />

      <Card className="mb-6 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Boxes size={16} className="text-muted" />
          <h2 className="display text-[17px] font-semibold">{t("Instances")}</h2>
        </div>
        <div className="-mx-2 flex flex-col">
          {instances.map((i) => (
            <ClientRow key={i.id} inst={i} />
          ))}
        </div>
      </Card>

      <h2 className="display mb-3 text-[17px] font-semibold">{t("Client settings")}</h2>
      <OptionTabs kind="client" />

      <Card className="mt-6 flex items-center gap-4 p-5">
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
