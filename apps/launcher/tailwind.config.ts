import type { Config } from "tailwindcss";

// Colors resolve to CSS variables defined in src/styles.css, so themes swap without rebuilding.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        raised: token("raised"),
        line: token("line"),
        fg: token("fg"),
        muted: token("muted"),
        accent: token("accent"),
        "accent-fg": token("accent-fg"),
        success: token("success"),
        danger: token("danger"),
      },
      fontFamily: {
        sans: ['"Instrument Sans Variable"', "Instrument Sans", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ['"Bricolage Grotesque Variable"', "system-ui", "sans-serif"],
      },
      // Radius grows with the size of the thing: controls 6, wells 8, panels 12, dialogs 16.
      borderRadius: {
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
      },
      transitionDuration: {
        DEFAULT: "160ms",
      },
    },
  },
  plugins: [],
} satisfies Config;
