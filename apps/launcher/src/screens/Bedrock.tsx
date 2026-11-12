import { t } from "../i18n";
import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { FileCode2, Loader2, MonitorX, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, PageHeader, Segmented, Toggle } from "../components/ui";
import { api, errorText, inTauri, type BedrockConfig, type BedrockStatus } from "../lib/api";

const STORE_URL = "https://apps.microsoft.com/detail/9NBLGGH2JHXJ";
const LATITE_URL = "https://github.com/LatiteClient/Latite";

/** Outside the desktop app there's no backend to ask, so go by the browser's platform. */
const looksLikeWindows = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);

export function BedrockScreen() {
  const [status, setStatus] = useState<BedrockStatus | null>(null);
  const [loading, setLoading] = useState(inTauri);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!inTauri) return;
    setLoading(true);
    api
      .bedrockStatus()
      .then(setStatus)
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const supported = status ? status.supported : looksLikeWindows;
  const config: BedrockConfig = status?.config ?? { clientEnabled: false, client: "latite", customDll: null };

  const save = async (next: Partial<BedrockConfig>) => {
    setError(null);
    try {
      setStatus(await api.bedrockSetConfig({ ...config, ...next }));
    } catch (e) {
      setError(errorText(e));
    }
  };

  const chooseDll = async () => {
    const file = await open({ multiple: false, filters: [{ name: t("Client DLL"), extensions: ["dll"] }] });
    if (typeof file === "string") await save({ client: "custom", customDll: file });
  };

  const play = async () => {
    setBusy(true);
    setError(null);
    setNote(config.clientEnabled ? t("Starting Bedrock and loading the client…") : null);
    try {
      setNote(t(await api.bedrockLaunch()));
      load();
    } catch (e) {
      setNote(null);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <>
        <PageHeader subtitle={t("Minecraft: Bedrock Edition, with an optional client.")} />
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <MonitorX size={28} className="text-muted" />
          <p className="display flex items-center gap-2 text-[16px] font-semibold">
            {t("Bedrock is only available on Windows")}
            <BetaTag />
          </p>
          <p className="max-w-md text-[13px] text-muted">
            {t("Mojang only makes Minecraft: Bedrock Edition for Windows, not for macOS or Linux. Open Novex on a Windows PC to play it, or play Java Edition here.")}
          </p>
          <Badge>{t("Windows only")}</Badge>
        </Card>
      </>
    );
  }

  const canPlay = !!status?.installed && !busy && !(config.clientEnabled && config.client === "custom" && !config.customDll);

  return (
    <>
      <PageHeader
        subtitle={t("Minecraft: Bedrock Edition, with an optional client.")}
        actions={
          <Button variant="ghost" icon={RefreshCw} onClick={load} disabled={loading}>
            {t("Refresh")}
          </Button>
        }
      />

      <div className="space-y-4">
        <Card className="flex items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="display flex items-center gap-2 text-[16px] font-semibold">
              {t("Minecraft: Bedrock Edition")}
              <BetaTag />
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              {loading && !status
                ? t("Checking…")
                : status?.installed
                  ? t("Installed · version {v}", { v: status.version ?? "?" }) + (status.running ? ` · ${t("Running")}` : "")
                  : t("Not installed. Get it from the Microsoft Store or the Xbox app with the account that owns it.")}
            </p>
          </div>
          {status && !status.installed ? (
            <Button variant="primary" onClick={() => openUrl(STORE_URL)}>
              {t("Open Microsoft Store")}
            </Button>
          ) : (
            <Button variant="primary" icon={busy ? Loader2 : Play} onClick={play} disabled={!canPlay}>
              {busy ? t("Starting…") : status?.running ? (config.clientEnabled ? t("Load client") : t("Running")) : t("Play")}
            </Button>
          )}
        </Card>

        <p className="text-[12px] text-muted">
          {t("Bedrock support is in beta. Starting the game and loading clients may not work on every setup yet.")}
        </p>

        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium">{t("Bedrock client")}</p>
              <p className="text-[12px] text-muted">
                {t("Loads a client into the game when it starts, for a HUD, zoom, FPS counter and more.")}
              </p>
            </div>
            <Toggle label={t("Bedrock client")} checked={config.clientEnabled} onChange={(on) => save({ clientEnabled: on })} />
          </div>

          {config.clientEnabled && (
            <>
              <Segmented
                value={config.client}
                onChange={(client) => (client === "custom" && !config.customDll ? chooseDll() : save({ client }))}
                options={[
                  { value: "latite", label: t("Latite") },
                  { value: "custom", label: t("My own DLL") },
                ]}
              />
              {config.client === "latite" ? (
                <p className="text-[12px] text-muted">
                  {t("Latite is a free, open-source client. Novex downloads it from its official GitHub release and checks it before use.")}{" "}
                  {status?.latiteVersion && t("Downloaded: {v}.", { v: status.latiteVersion })}{" "}
                  <button type="button" className="text-accent hover:underline" onClick={() => openUrl(LATITE_URL)}>
                    {t("About Latite")}
                  </button>
                </p>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-2 text-[12px] text-muted">
                    <FileCode2 size={14} className="shrink-0" />
                    <span className="truncate">{config.customDll ?? t("No DLL chosen")}</span>
                  </p>
                  <Button variant="subtle" onClick={chooseDll}>
                    {t("Choose…")}
                  </Button>
                </div>
              )}
              <p className="flex items-start gap-2 rounded-lg bg-fg/[0.04] p-3 text-[12px] text-muted">
                <ShieldCheck size={14} className="mt-px shrink-0 text-success" />
                {t("Only 64-bit Windows DLLs are loaded, copied into Novex's folder first, and only into Minecraft itself. Some servers don't allow clients; check their rules.")}
              </p>
            </>
          )}
        </Card>

        {note && <p className="text-[13px] text-muted">{note}</p>}
        {error && <p className="text-[13px] text-danger">{error}</p>}
      </div>
    </>
  );
}

function BetaTag() {
  return (
    <span className="rounded-full bg-accent/15 px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-accent">
      {t("Beta")}
    </span>
  );
}
