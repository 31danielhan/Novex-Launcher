import { useEffect, useState, type ReactNode } from "react";
import { useApp, type ThemePref } from "../store";
import { useLauncher } from "../launcher";
import { api, errorText, inTauri, type Settings } from "../lib/api";
import { osLabel, useSystemInfo } from "../lib/system";
import { inputClass } from "../components/Dialog";
import { Button, Card, Segmented } from "../components/ui";

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

function JavaSettings() {
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

  if (!s) {
    return (
      <Card className="mb-8">
        <Row label="Java" hint="Available in the desktop app.">
          —
        </Row>
      </Card>
    );
  }

  const gb = (s.maxMemoryMb / 1024).toFixed(1).replace(/\.0$/, "");
  return (
    <Card className="mb-8">
      <Row label="Memory" hint="Maximum RAM for the game. 4–6 GB suits most vanilla play.">
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
            aria-label="Maximum memory"
          />
          <span className="w-12 text-right font-medium text-fg">{gb} GB</span>
        </div>
      </Row>
      <Row label="Java executable" hint="Leave empty to use the Java that Novex downloads.">
        <input
          defaultValue={s.javaPath ?? ""}
          onBlur={(e) => e.target.value !== (s.javaPath ?? "") && save({ ...s, javaPath: e.target.value })}
          placeholder="Automatic"
          className={`${inputClass} w-64`}
          spellCheck={false}
        />
      </Row>
      <Row label="JVM arguments" hint="Extra flags passed to Java.">
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

export function SettingsScreen() {
  const { theme, setTheme } = useApp();
  const { accounts, activeAccount, openAccounts } = useLauncher();
  const info = useSystemInfo();
  const active = accounts.find((a) => a.uuid === activeAccount);

  return (
    <>
      <h2 className="mb-2 px-1 text-[13px] font-semibold">Account</h2>
      <Card className="mb-8">
        <Row label={active ? active.name : "Not signed in"} hint={active ? "Playing as this account" : undefined}>
          <Button onClick={() => openAccounts(true)}>{active ? "Manage" : "Sign in"}</Button>
        </Row>
      </Card>

      <h2 className="mb-2 px-1 text-[13px] font-semibold">Java</h2>
      <JavaSettings />

      <h2 className="mb-2 px-1 text-[13px] font-semibold">Appearance</h2>
      <Card className="mb-8">
        <Row label="Theme">
          <Segmented<ThemePref>
            value={theme}
            onChange={setTheme}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
              { value: "system", label: "System" },
            ]}
          />
        </Row>
      </Card>

      <h2 className="mb-2 px-1 text-[13px] font-semibold">About</h2>
      <Card>
        <Row label="Version">{info?.appVersion ?? "—"}</Row>
        <Row label="Platform">
          {info ? `${osLabel[info.os] ?? info.os} · ${info.arch}` : "Browser preview"}
        </Row>
        <Row label="Data folder" hint="Instances, Java runtimes and settings live here.">
          <span className="block max-w-xs truncate font-mono text-[12px]" title={info?.dataDir}>
            {info?.dataDir ?? "—"}
          </span>
        </Row>
      </Card>
    </>
  );
}
