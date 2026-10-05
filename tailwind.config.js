/** @type {import('tailwindcss').Config} */
const withVar = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: withVar("background"),
        card: {
          DEFAULT: withVar("card"),
          raised: withVar("card-raised"),
        },
        muted: withVar("muted"),
        border: {
          DEFAULT: withVar("border"),
          strong: withVar("border-strong"),
        },
        foreground: {
          DEFAULT: withVar("foreground"),
          secondary: withVar("foreground-secondary"),
          muted: withVar("foreground-muted"),
        },
        primary: {
          DEFAULT: withVar("primary"),
          hover: withVar("primary-hover"),
          foreground: withVar("primary-foreground"),
        },
        brand: {
          DEFAULT: withVar("brand"),
          accent: withVar("brand-accent"),
        },
        gold: {
          DEFAULT: withVar("gold"),
          hover: withVar("gold-hover"),
        },
        success: withVar("success"),
        danger: withVar("danger"),
        warning: withVar("warning"),
        info: withVar("info"),
      },
    },
  },
  plugins: [],
};
