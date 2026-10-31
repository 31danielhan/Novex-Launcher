import { useEffect, useState, type ReactNode } from "react";
import { useApp, type ThemePref } from "../store";
import { getSystemInfo, osLabel, type SystemInfo } from "../lib/system";
import { Card, PageHeader, Segmented } from "../components/ui";

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

export function SettingsScreen() {
  const { theme, setTheme } = useApp();
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    getSystemInfo().then(setInfo).catch(() => setInfo(null));
  }, []);

  return (
    <>
      <PageHeader title="Settings" />

      <h2 className="mb-2 text-[13px] font-medium text-muted">Appearance</h2>
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

      <h2 className="mb-2 text-[13px] font-medium text-muted">About</h2>
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
