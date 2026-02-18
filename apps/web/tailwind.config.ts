import type { Config } from "tailwindcss";
import { orbytBaseConfig } from "@orbyt/config/tailwind";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    ...orbytBaseConfig.theme,
    extend: {
      ...orbytBaseConfig.theme?.extend,
    },
  },
  plugins: [],
};

export default config;
