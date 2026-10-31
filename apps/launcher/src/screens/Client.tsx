import { useState } from "react";
import { Gauge, LayoutDashboard, Swords } from "lucide-react";
import { Badge, Card, PageHeader, Segmented, Toggle } from "../components/ui";

type Preset = "balanced" | "performance" | "lowend";

const hudModules = [
  "FPS",
  "CPS",
  "Ping",
  "Coordinates",
  "Keystrokes",
  "Armor status",
  "Potion effects",
  "Toggle sprint",
  "Zoom",
  "Crosshair",
];

export function ClientScreen() {
  const [enabled, setEnabled] = useState(false);
  const [preset, setPreset] = useState<Preset>("balanced");

  return (
    <>
      <PageHeader
        subtitle="Built-in PvP client: FPS boost and HUD mods, toggled per instance."
        actions={<Badge>Coming soon</Badge>}
      />

      <Card className="mb-4 flex items-center gap-4 p-5">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-raised text-fg">
          <Swords size={20} />
        </div>
        <div className="flex-1">
          <p className="font-medium">Enable Novex Client</p>
          <p className="text-[13px] text-muted">
            Adds the client mod and performance mods in a managed folder. Your own mods stay untouched.
          </p>
        </div>
        <Toggle label="Enable Novex Client" checked={enabled} onChange={setEnabled} disabled />
      </Card>

      <Card className="mb-4 flex items-center gap-4 p-5">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-raised text-fg">
          <Gauge size={20} />
        </div>
        <div className="flex-1">
          <p className="font-medium">FPS preset</p>
          <p className="text-[13px] text-muted">Tunes JVM flags and video settings.</p>
        </div>
        <Segmented
          value={preset}
          onChange={setPreset}
          disabled
          options={[
            { value: "balanced", label: "Balanced" },
            { value: "performance", label: "Performance" },
            { value: "lowend", label: "Low-end" },
          ]}
        />
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <LayoutDashboard size={16} className="text-muted" />
          <p className="font-medium">HUD modules</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {hudModules.map((m) => (
            <div key={m} className="rounded-full bg-raised px-3.5 py-2 text-center text-[13px] text-muted">
              {m}
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-muted">
          Cosmetic and information-only features. No reach, hitbox, auto-click or ESP.
        </p>
      </Card>
    </>
  );
}
