import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0B5C3F",
          dark: "#07402C",
          deep: "#073B29",
          light: "#E8F3EE",
        },
        gold: {
          DEFAULT: "#F2B705",
          dark: "#C99600",
          light: "#FFF6D6",
        },
        surface: "#F4F6F5",
      },
      // Everything is rem-based; the root font size (14/16/18px) is set by the "Aa" text-size setting.
      keyframes: {
        "drawer-in": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
      },
      animation: {
        "drawer-in": "drawer-in 0.22s ease-out",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
        float: "0 12px 28px -14px rgba(7, 59, 41, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
