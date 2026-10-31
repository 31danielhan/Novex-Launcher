import type { Config } from "tailwindcss";

// Colors resolve to CSS variables defined in src/styles.css, so themes swap without rebuilding.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
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
        sans: ['"Inter Variable"', "Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px",
      },
      transitionDuration: {
        DEFAULT: "160ms",
      },
    },
  },
  plugins: [],
} satisfies Config;
