import { create } from "zustand";
import { languages, resolveLanguage, setLanguage as applyLanguage, type LanguagePref } from "./i18n";

export type Screen = "home" | "instances" | "browse" | "client" | "bedrock" | "game" | "settings";
export type ThemePref = "dark" | "light" | "system";
/** Color theme. Most use liquid-glass surfaces over a colored backdrop (Classic only lightly);
    PCL and Prism are flat. */
export type Palette =
  | "classic"
  | "glass"
  | "aurora"
  | "ocean"
  | "sunset"
  | "forest"
  | "gold"
  | "pumpkin"
  | "pcl"
  | "prism"
  | "minecraft"
  | "poly";

export type SearchTarget = "game" | "client" | "browse";

const flat: Palette[] = ["pcl", "prism", "minecraft", "poly"];

export const palettes: { value: Palette; label: string; swatch: string }[] = [
  // Colors from OneLauncher's PolyGlass themes by Polyfrost (GPL-3.0).
  { value: "poly", label: "Poly", swatch: "linear-gradient(135deg, #11171c 50%, #2b4bff 50%)" },
  { value: "classic", label: "Classic", swatch: "linear-gradient(135deg, #e4e7e9, #2e6840)" },
  { value: "glass", label: "Glass", swatch: "linear-gradient(135deg, #c7d2fe, #fbcfe8, #bae6fd)" },
  { value: "aurora", label: "Aurora", swatch: "linear-gradient(135deg, #8b5cf6, #2dd4bf)" },
  { value: "ocean", label: "Ocean", swatch: "linear-gradient(135deg, #2563eb, #22d3ee)" },
  { value: "sunset", label: "Sunset", swatch: "linear-gradient(135deg, #f97316, #ec4899)" },
  { value: "forest", label: "Forest", swatch: "linear-gradient(135deg, #16a34a, #a3e635)" },
  { value: "gold", label: "Gold", swatch: "linear-gradient(135deg, #fde68a, #f59e0b, #b45309)" },
  { value: "pumpkin", label: "Pumpkin", swatch: "linear-gradient(135deg, #fed7aa, #f08a24)" },
  { value: "pcl", label: "PCL", swatch: "linear-gradient(135deg, #ffffff 50%, #1d1d22 50%), #1370f3" },
  { value: "prism", label: "Prism", swatch: "linear-gradient(135deg, #ffffff, #8fd694)" },
  { value: "minecraft", label: "Minecraft", swatch: "linear-gradient(180deg, #5d9b3a 35%, #866043 35%)" },
];

const THEME_KEY = "novex.theme";
const PALETTE_KEY = "novex.palette";
const LANGUAGE_KEY = "novex.language";
const BLUR_KEY = "novex.windowBlur";

/** How much glass themes blur the desktop behind them, 0–100 percent. The tint over it stays at
    80% (--window-alpha in styles.css). */
function readBlur(): number {
  try {
    const raw = localStorage.getItem(BLUR_KEY);
    const v = Number(raw);
    if (raw !== null && v >= 0 && v <= 100) return v;
  } catch {
    // Storage can be unavailable; fall back to the default.
  }
  return 50;
}

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v && (allowed as readonly string[]).includes(v)) return v as T;
  } catch {
    // Storage can be unavailable; fall back to the default.
  }
  return fallback;
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Non-fatal: the choice just won't persist.
  }
}

function applyTheme(pref: ThemePref) {
  const resolved =
    pref === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : pref;
  document.documentElement.dataset.theme = resolved;
  // The desktop blur behind glass themes goes dark or light with the mode.
  const palette = document.documentElement.dataset.palette as Palette | undefined;
  if (palette && !flat.includes(palette)) windowGlass(true, readBlur());
}

function applyPalette(p: Palette) {
  const root = document.documentElement;
  root.dataset.palette = p;
  const glass = !flat.includes(p);
  if (glass) root.dataset.glass = "";
  else delete root.dataset.glass;
  windowGlass(glass, readBlur());
}

/** Glass themes get a light blur of the desktop behind their see-through tint (see glass.rs). Flat
    themes stay solid. Only in the desktop app. */
function windowGlass(on: boolean, blur: number) {
  if (!("__TAURI_INTERNALS__" in window)) return;
  import("@tauri-apps/api/core")
    .then(({ invoke }) =>
      invoke("window_glass", {
        on,
        strength: blur / 100,
        dark: document.documentElement.dataset.theme === "dark",
      }),
    )
    .catch(() => {
      // Older systems without window effects keep a clear tint.
    });
}

interface AppState {
  screen: Screen;
  theme: ThemePref;
  palette: Palette;
  language: LanguagePref;
  /** A search handed over by the top bar, for the screen that shows it to pick up. */
  pendingSearch: { target: SearchTarget; query: string } | null;
  setPendingSearch: (p: { target: SearchTarget; query: string } | null) => void;
  setScreen: (s: Screen) => void;
  setLanguage: (l: LanguagePref) => void;
  setTheme: (t: ThemePref) => void;
  setPalette: (p: Palette) => void;
  /** How much glass themes blur the desktop, in percent. */
  windowBlur: number;
  setWindowBlur: (percent: number) => void;
}

export const useApp = create<AppState>((set) => ({
  screen: "home",
  theme: read<ThemePref>(THEME_KEY, ["dark", "light", "system"], "light"),
  palette: read<Palette>(
    PALETTE_KEY,
    palettes.map((p) => p.value),
    "poly",
  ),
  language: read<LanguagePref>(LANGUAGE_KEY, ["system", ...languages.map((l) => l.value)], "system"),
  windowBlur: readBlur(),
  setWindowBlur: (windowBlur) => {
    write(BLUR_KEY, String(windowBlur));
    set({ windowBlur });
    if (!flat.includes(useApp.getState().palette)) windowGlass(true, windowBlur);
  },
  pendingSearch: null,
  setPendingSearch: (pendingSearch) => set({ pendingSearch }),
  setScreen: (screen) => set({ screen }),
  setLanguage: (language) => {
    write(LANGUAGE_KEY, language);
    applyLanguage(resolveLanguage(language));
    set({ language });
  },
  setTheme: (theme) => {
    write(THEME_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },
  setPalette: (palette) => {
    write(PALETTE_KEY, palette);
    applyPalette(palette);
    set({ palette });
  },
}));

applyTheme(useApp.getState().theme);
applyLanguage(resolveLanguage(useApp.getState().language));
applyPalette(useApp.getState().palette);
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
  if (useApp.getState().theme === "system") applyTheme("system");
});
