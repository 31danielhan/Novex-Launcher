import type { GameOption, OptionsPage } from "./gameOptions";

/**
 * Novex Client's settings, with the same keys and defaults as Config.java in the mod. The launcher
 * writes them into each instance's config/novex-client.json before it launches.
 */
const pct = (v: number) => `${v}%`;
const size = (id: string, label: string): GameOption => ({
  kind: "slider",
  id: `hudSize.${id}`,
  label,
  def: 1,
  min: 0.5,
  max: 3,
  step: 0.05,
  show: (v) => pct(Math.round(v * 100)),
});

const hud: OptionsPage = {
  id: "hud",
  title: "HUD",
  options: [
    { kind: "toggle", id: "fps", label: "FPS", def: true },
    { kind: "toggle", id: "cps", label: "CPS", def: true },
    { kind: "toggle", id: "ping", label: "Ping", def: true },
    { kind: "toggle", id: "coordinates", label: "Coordinates", def: true },
    { kind: "toggle", id: "keystrokes", label: "Keystrokes", def: true },
    { kind: "toggle", id: "armor", label: "Armor status", def: true },
    { kind: "toggle", id: "effects", label: "Potion effects", def: true },
    { kind: "toggle", id: "titleButton", label: "Title screen button", def: true },
  ],
};

const style: OptionsPage = {
  id: "style",
  title: "HUD Style",
  options: [
    {
      kind: "cycle",
      id: "hudTextColor",
      label: "Text color",
      def: 0xf2f4f5,
      values: [
        [0xf2f4f5, "White"],
        [0x76ba7c, "Green"],
        [0x55d6f5, "Aqua"],
        [0xf5d055, "Gold"],
        [0xf0766a, "Red"],
        [0xc39bf5, "Purple"],
      ],
    },
    { kind: "toggle", id: "hudShadow", label: "Text shadow", def: false },
    { kind: "toggle", id: "hudPlates", label: "Backgrounds", def: true },
    { kind: "slider", id: "hudPlateOpacity", label: "Background opacity", def: 40, min: 0, max: 100, step: 5, show: pct },
  ],
};

const gameplay: OptionsPage = {
  id: "gameplay",
  title: "Gameplay",
  options: [
    { kind: "toggle", id: "toggleSprint", label: "Toggle sprint", def: false },
    { kind: "toggle", id: "zoom", label: "Zoom", def: true },
    { kind: "toggle", id: "motionBlur", label: "Motion blur", def: false },
  ],
};

/** What only the 1.8.9 Forge build has. */
const legacy: OptionsPage = {
  id: "legacy",
  title: "1.8 Tweaks",
  options: [
    { kind: "toggle", id: "oldBlockHit", label: "1.7 block hit", def: true },
    { kind: "toggle", id: "oldEating", label: "1.7 eating", def: true },
    { kind: "toggle", id: "damageTilt", label: "Damage tilt", def: true },
    { kind: "toggle", id: "fovEffects", label: "FOV effects", def: true },
    { kind: "toggle", id: "sidebar", label: "Sidebar", def: true },
    { kind: "toggle", id: "buildLimit", label: "Build height limit", def: true },
  ],
};

/** The options behind a module's card, by the module's id. */
export const moduleOptions: Record<string, GameOption[]> = {
  fps: [size("fps", "Size")],
  cps: [size("cps", "Size")],
  ping: [size("ping", "Size")],
  coordinates: [
    size("coordinates", "Size"),
    { kind: "cycle", id: "coordinatesDecimals", label: "Coordinate decimals", def: 0, values: [[0, "0"], [1, "1"], [2, "2"]] },
    { kind: "toggle", id: "coordinatesFacing", label: "Show facing direction", def: true },
  ],
  keystrokes: [
    size("keystrokes", "Size"),
    { kind: "toggle", id: "keystrokesMouse", label: "Show mouse buttons", def: true },
    { kind: "toggle", id: "keystrokesJump", label: "Show jump key", def: true },
  ],
  armor: [size("armor", "Size")],
  effects: [size("effects", "Size")],
  zoom: [{ kind: "cycle", id: "zoomFactor", label: "Zoom strength", def: 4, values: [[2, "2×"], [4, "4×"], [8, "8×"]] }],
  motionBlur: [
    {
      kind: "cycle",
      id: "motionBlurLevel",
      label: "Motion blur strength",
      def: 2,
      values: [[1, "Light"], [2, "Medium"], [3, "Strong"]],
    },
  ],
  sidebar: [{ kind: "toggle", id: "sidebarNumbers", label: "Sidebar numbers", def: false }],
  buildLimit: [{ kind: "slider", id: "buildHeight", label: "Build height", def: 255, min: 1, max: 255, step: 1, show: String }],
};

export const clientPages = (is18: boolean): OptionsPage[] =>
  is18 ? [hud, style, gameplay, legacy] : [hud, style, gameplay];
