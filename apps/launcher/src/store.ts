import { create } from "zustand";

export type Screen = "home" | "instances" | "browse" | "client" | "settings";
export type ThemePref = "dark" | "light" | "system";

const THEME_KEY = "novex.theme";

function readTheme(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch {
    // Storage can be unavailable; fall back to the default.
  }
  return "light";
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

interface AppState {
  screen: Screen;
  theme: ThemePref;
  setScreen: (s: Screen) => void;
  setTheme: (t: ThemePref) => void;
}

export const useApp = create<AppState>((set) => ({
  screen: "home",
  theme: readTheme(),
  setScreen: (screen) => set({ screen }),
  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Non-fatal: theme just won't persist.
    }
    applyTheme(theme);
    set({ theme });
  },
}));

applyTheme(useApp.getState().theme);
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
  if (useApp.getState().theme === "system") applyTheme("system");
});
