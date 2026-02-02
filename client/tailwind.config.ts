import type { Config } from "tailwindcss";

const config: Config = {
  corePlugins: {
    preflight: false, /* Stops color: inherit on form elements (was in 28693c78a7ef8437.css) */
  },
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: "#0d9488",
          dark: "#0f766e",
          light: "#14b8a6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
