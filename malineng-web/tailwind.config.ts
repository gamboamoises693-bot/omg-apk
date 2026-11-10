import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Executive theme: navy and gold on a cool light ground.
        brand: {
          DEFAULT: "#1F5FAE",
          dark: "#123F7A",
          deep: "#0B2B57",
          light: "#E8F0FB",
        },
        gold: {
          DEFAULT: "#D4AF37",
          dark: "#9A7B12",
          light: "#F7EBC3",
        },
        line: "#E3E8F0",
        surface: "#F4F6FA",
      },
      // Everything is rem-based; the root font size (14/16/18px) is set by the "Aa" text-size setting.
      keyframes: {
        "drawer-in": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "like-pop": { "0%": { transform: "scale(1)" }, "40%": { transform: "scale(1.35)" }, "100%": { transform: "scale(1)" } },
      },
      animation: {
        "drawer-in": "drawer-in 0.22s ease-out",
        "like-pop": "like-pop 0.3s ease-out",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 16px -8px rgba(15, 23, 42, 0.10)",
        float: "0 12px 28px -14px rgba(15, 58, 112, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
