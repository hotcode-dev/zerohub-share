import { light, dark } from "daisyui-ntsd";

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,svelte,ts,svx,md}"],
  safelist: ["alert-info", "alert-success", "alert-error"],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography"), require("daisyui")],
  darkMode: ["class"], // media for system dark mode
  daisyui: {
    themes: [
      {
        light: {
          ...light,
          fontFamily: "Inter, sans-serif, system-ui",
        },
      },
      {
        dark: {
          ...dark,
          fontFamily: "Inter, sans-serif, system-ui",
        },
      },
    ],
  },
};
