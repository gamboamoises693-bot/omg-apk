import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0B5C3F",
          dark: "#07402C",
          light: "#E7F2EC",
        },
        gold: {
          DEFAULT: "#F2B705",
          dark: "#C99600",
          light: "#FFF6D6",
        },
        surface: "#F3F4F6",
      },
      fontSize: {
        // Slightly bigger base text for senior-friendly reading.
        base: ["1.0625rem", "1.6rem"],
      },
    },
  },
  plugins: [],
};

export default config;
