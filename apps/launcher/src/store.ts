import { create } from "zustand";
import { languages, resolveLanguage, setLanguage as applyLanguage, type LanguagePref } from "./i18n";

export type Screen = "home" | "instances" | "browse" | "client" | "game" | "settings";
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
  | "pumpkin"
  | "pcl"
  | "prism";

export type SearchTarget = "game" | "client" | "browse";

const flat: Palette[] = ["pcl", "prism"];

export const palettes: { value: Palette; label: string; swatch: string }[] = [
  { value: "classic", label: "Classic", swatch: "linear-gradient(135deg, #e4e7e9, #2e6840)" },
  { value: "glass", label: "Glass", swatch: "linear-gradient(135deg, #c7d2fe, #fbcfe8, #bae6fd)" },
  { value: "aurora", label: "Aurora", swatch: "linear-gradient(135deg, #8b5cf6, #2dd4bf)" },
  { value: "ocean", label: "Ocean", swatch: "linear-gradient(135deg, #2563eb, #22d3ee)" },
  { value: "sunset", label: "Sunset", swatch: "linear-gradient(135deg, #f97316, #ec4899)" },
  { value: "forest", label: "Forest", swatch: "linear-gradient(135deg, #16a34a, #a3e635)" },
  { value: "pumpkin", label: "Pumpkin", swatch: "linear-gradient(135deg, #fed7aa, #f08a24)" },
  { value: "pcl", label: "PCL", swatch: "linear-gradient(135deg, #ffffff 50%, #1d1d22 50%), #1370f3" },
  { value: "prism", label: "Prism", swatch: "linear-gradient(135deg, #ffffff, #8fd694)" },
];

const THEME_KEY = "novex.theme";
const PALETTE_KEY = "novex.palette";
const LANGUAGE_KEY = "novex.language";

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
}

function applyPalette(p: Palette) {
  const root = document.documentElement;
  root.dataset.palette = p;
  if (flat.includes(p)) delete root.dataset.glass;
  else root.dataset.glass = "";
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
}

export const useApp = create<AppState>((set) => ({
  screen: "home",
  theme: read<ThemePref>(THEME_KEY, ["dark", "light", "system"], "light"),
  palette: read<Palette>(
    PALETTE_KEY,
    palettes.map((p) => p.value),
    "classic",
  ),
  language: read<LanguagePref>(LANGUAGE_KEY, ["system", ...languages.map((l) => l.value)], "system"),
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
