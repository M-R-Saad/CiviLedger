/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        paper: "var(--text-on-accent)",
        surface: {
          DEFAULT: "var(--surface)",
          sunken: "var(--surface-sunken)",
        },
        ink: {
          DEFAULT: "var(--text)",
          muted: "var(--text-muted)",
          subtle: "var(--text-subtle)",
        },
        line: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          active: "var(--accent-active)",
          quiet: "var(--accent-quiet)",
          border: "var(--accent-border)",
        },
        ok: {
          fg: "var(--ok-fg)",
          bg: "var(--ok-bg)",
          border: "var(--ok-border)",
        },
        warn: {
          fg: "var(--warn-fg)",
          bg: "var(--warn-bg)",
          border: "var(--warn-border)",
        },
        danger: {
          fg: "var(--danger-fg)",
          bg: "var(--danger-bg)",
          border: "var(--danger-border)",
        },
        warm: {
          bg: "var(--warm-bg)",
          border: "var(--warm-border)",
        },
        hero: {
          bg: "var(--hero-bg)",
          fg: "var(--hero-fg)",
          "fg-muted": "var(--hero-fg-muted)",
        },
      },
      fontFamily: {
        sans: [
          '"Anek Latin"',
          '"Anek Bangla"',
          '"Noto Sans Bengali"',
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          '"SF Mono"',
          '"Cascadia Mono"',
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        xs: ["0.75rem", "1rem"],
        sm: ["0.8125rem", "1.25rem"],
        base: ["0.875rem", "1.375rem"],
        md: ["1rem", "1.5rem"],
        lg: ["1.25rem", "1.75rem"],
        xl: ["1.5625rem", "2rem"],
        "2xl": ["1.9375rem", "2.375rem"],
        hero: ["clamp(2rem, 1.3rem + 3vw, 3.25rem)", "1.1"],
      },
      borderRadius: {
        control: "6px",
        container: "10px",
        media: "14px",
      },
      boxShadow: {
        overlay:
          "0 1px 2px oklch(0.24 0.01 75 / 0.08), 0 8px 24px oklch(0.24 0.01 75 / 0.10)",
        media: "var(--shadow-media)",
      },
    },
  },
  plugins: [],
};
