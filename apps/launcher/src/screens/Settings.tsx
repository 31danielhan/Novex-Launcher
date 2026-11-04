import { t } from "../i18n";
import { useEffect, useState, type ReactNode } from "react";
import { palettes, useApp, type ThemePref } from "../store";
import { languages, type LanguagePref } from "../i18n";
import { useLauncher } from "../launcher";
import { api, errorText, inTauri, type Settings, type UpdateInfo } from "../lib/api";
import { osLabel, useSystemInfo } from "../lib/system";
import { inputClass } from "../components/Dialog";
import { Button, Card, cx, Segmented, Toggle } from "../components/ui";

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="hairline flex items-center justify-between gap-6 border-b px-5 py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {hint && <p className="text-[13px] text-muted">{hint}</p>}
      </div>
      <div className="min-w-0 shrink-0 text-right text-[13px] text-muted">{children}</div>
    </div>
  );
}

/** Global settings, loaded once and shared by every section so saves don't overwrite each other. */
export function useSettings() {
  const setError = useLauncher((s) => s.setError);
  const [s, setS] = useState<Settings | null>(null);

  useEffect(() => {
    if (inTauri) api.settings().then(setS).catch((e) => setError(errorText(e)));
  }, [setError]);

  const save = async (next: Settings) => {
    setS(next);
    try {
      setS(await api.saveSettings(next));
    } catch (e) {
      setError(errorText(e));
    }
  };
  return { s, setS, save };
}

type SettingsProps = ReturnType<typeof useSettings>;

function JavaSettings({ s, setS, save }: SettingsProps) {
  if (!s) {
    return (
      <Card className="mb-8">
        <Row label={t("Java")} hint={t("Available in the desktop app.")}>
          —
        </Row>
      </Card>
    );
  }

  const gb = (s.maxMemoryMb / 1024).toFixed(1).replace(/\.0$/, "");
  return (
    <Card className="mb-8">
      <Row label={t("Memory")} hint={t("Maximum RAM for the game. 4–6 GB suits most vanilla play.")}>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1024}
            max={16384}
            step={512}
            value={s.maxMemoryMb}
            onChange={(e) => setS({ ...s, maxMemoryMb: Number(e.target.value) })}
            onPointerUp={() => save(s)}
            onKeyUp={() => save(s)}
            className="w-40 accent-[rgb(var(--accent))]"
            aria-label={t("Maximum memory")}
          />
          <span className="w-12 text-right font-medium text-fg">{gb} GB</span>
        </div>
      </Row>
      <Row label={t("Java executable")} hint={t("Leave empty to use the Java that Novex downloads.")}>
        <input
          defaultValue={s.javaPath ?? ""}
          onBlur={(e) => e.target.value !== (s.javaPath ?? "") && save({ ...s, javaPath: e.target.value })}
          placeholder={t("Automatic")}
          className={`${inputClass} w-64`}
          spellCheck={false}
        />
      </Row>
      <Row label={t("JVM arguments")} hint={t("Extra flags passed to Java.")}>
        <input
          defaultValue={s.jvmArgs}
          onBlur={(e) => e.target.value !== s.jvmArgs && save({ ...s, jvmArgs: e.target.value })}
          placeholder="-XX:+UseG1GC"
          className={`${inputClass} w-64 font-mono`}
          spellCheck={false}
        />
      </Row>
    </Card>
  );
}

function ContentSources({ s, save }: SettingsProps) {
  const [shown, setShown] = useState(false);
  if (!s) return null;
  return (
    <Card className="mb-8">
      <Row label={t("Modrinth")} hint={t("Works without setup.")}>
        <span className="text-success">{t("Ready")}</span>
      </Row>
      <Row
        label={t("CurseForge API key")}
        hint={t("Create a free key at console.curseforge.com, then paste it here.")}
      >
        <div className="flex items-center gap-2">
          <input
            type={shown ? "text" : "password"}
            defaultValue={s.curseforgeApiKey ?? ""}
            onBlur={(e) =>
              e.target.value.trim() !== (s.curseforgeApiKey ?? "") &&
              save({ ...s, curseforgeApiKey: e.target.value })
            }
            placeholder={t("Not set")}
            className={`${inputClass} w-64 font-mono`}
            spellCheck={false}
            autoComplete="off"
            aria-label={t("CurseForge API key")}
          />
          <Button variant="ghost" className="h-9 px-3" onClick={() => setShown(!shown)}>
            {t(shown ? "Hide" : "Show")}
          </Button>
        </div>
      </Row>
    </Card>
  );
}

function Updates({ s, save }: SettingsProps) {
  const { checkForUpdates, available, applyUpdate, updating } = useLauncher();
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (inTauri) api.updateInfo().then(setInfo).catch(() => {});
  }, []);

  if (!info || !s) {
    return (
      <Card className="mb-8">
        <Row label={t("Updates")} hint={t("Available in the desktop app.")}>
          —
        </Row>
      </Card>
    );
  }

  const check = async () => {
    setChecking(true);
    await checkForUpdates(true);
    setChecking(false);
  };

  const useBuiltIn = async () => {
    await api.uiReset();
    window.location.reload();
  };

  return (
    <Card className="mb-8">
      <Row
        label={`Novex ${info.appVersion}`}
        hint={
          !info.configured
            ? t("This build wasn't given a GitHub repository to update from.")
            : available
              ? available.kind === "app"
                ? `Version ${available.update.version} is available.`
                : `A new interface (${available.version}) is available.`
              : t("Updates come from GitHub and are checked against Novex's signing key.")
        }
      >
        {available ? (
          <Button variant="primary" onClick={applyUpdate} disabled={!!updating}>
            {t(available.kind === "app" ? "Update and restart" : "Update interface")}
          </Button>
        ) : (
          <Button onClick={check} disabled={checking || !info.configured}>
            {t(checking ? "Checking…" : "Check for updates")}
          </Button>
        )}
      </Row>
      <Row label={t("Interface")} hint={t("Small fixes can arrive without reinstalling. They need the same signing key.")}>
        {info.uiVersion ? (
          <span className="flex items-center gap-3">
            {info.uiVersion} (downloaded)
            <Button variant="ghost" onClick={useBuiltIn}>
              Use built-in
            </Button>
          </span>
        ) : (
          t("Built in")
        )}
      </Row>
      <Row label={t("Check automatically")} hint={t("Look for updates each time Novex starts.")}>
        <Toggle
          label={t("Check for updates automatically")}
          checked={s.autoUpdate}
          disabled={!info.configured}
          onChange={(autoUpdate) => save({ ...s, autoUpdate })}
        />
      </Row>
    </Card>
  );
}

export function SettingsScreen() {
  const { theme, setTheme, palette, setPalette, language, setLanguage } = useApp();
  const settings = useSettings();
  const { accounts, activeAccount, openAccounts } = useLauncher();
  const info = useSystemInfo();
  const active = accounts.find((a) => a.uuid === activeAccount);

  return (
    <>
      <h2 className="display mb-2 px-1 text-[16px] font-semibold">{t("Account")}</h2>
      <Card className="mb-8">
        <Row label={active ? active.name : t("Not signed in")} hint={active ? t("Playing as this account") : undefined}>
          <Button onClick={() => openAccounts(true)}>{t(active ? "Manage" : "Sign in")}</Button>
        </Row>
      </Card>

      <h2 className="display mb-2 px-1 text-[16px] font-semibold">{t("Java")}</h2>
      <JavaSettings {...settings} />

      <h2 className="display mb-2 px-1 text-[16px] font-semibold">{t("Updates")}</h2>
      <Updates {...settings} />

      <h2 className="display mb-2 px-1 text-[16px] font-semibold">{t("Content sources")}</h2>
      <ContentSources {...settings} />

      <h2 className="display mb-2 px-1 text-[16px] font-semibold">{t("Appearance")}</h2>
      <Card className="mb-8">
        <Row label={t("Theme")} hint={t("PCL and Prism are flat; the others use liquid-glass panels.")}>
          <div className="flex gap-2">
            {palettes.map((p) => (
              <button
                key={p.value}
                onClick={() => setPalette(p.value)}
                aria-pressed={palette === p.value}
                title={p.label}
                className="group flex w-14 flex-col items-center gap-1.5 text-[11px]"
              >
                <span
                  className={cx(
                    "slot h-9 w-9 rounded-lg ring-offset-2 ring-offset-surface transition duration-200 group-hover:scale-110",
                    palette === p.value ? "ring-2 ring-accent" : "ring-1 ring-fg/10 hover:ring-fg/30",
                  )}
                  style={{ background: p.swatch }}
                />
                <span className={palette === p.value ? "text-fg" : ""}>{p.label}</span>
              </button>
            ))}
          </div>
        </Row>
        <Row label={t("Mode")}>
          <Segmented<ThemePref>
            value={theme}
            onChange={setTheme}
            options={[
              { value: "dark", label: t("Dark") },
              { value: "light", label: t("Light theme") },
              { value: "system", label: t("System") },
            ]}
          />
        </Row>
        <Row label={t("Language")} hint={t("Changes the launcher's language. Minecraft keeps its own language setting.")}>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguagePref)}
            aria-label={t("Language")}
            className={`${inputClass} w-44 cursor-pointer text-fg`}
          >
            <option value="system">{t("Match system")}</option>
            {languages.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Row>
      </Card>

      <h2 className="display mb-2 px-1 text-[16px] font-semibold">{t("About")}</h2>
      <Card>
        <Row label={t("Version")}>{info?.appVersion ?? "—"}</Row>
        <Row label={t("Platform")}>
          {info ? `${osLabel[info.os] ?? info.os} · ${info.arch}` : t("Browser preview")}
        </Row>
        <Row label={t("Data folder")} hint={t("Instances, Java runtimes and settings live here.")}>
          <span className="block max-w-xs truncate font-mono text-[12px]" title={info?.dataDir}>
            {info?.dataDir ?? "—"}
          </span>
        </Row>
      </Card>
    </>
  );
}
