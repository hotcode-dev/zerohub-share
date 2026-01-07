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
          primary: "#8B5CF6",
          fontFamily: "Inter, sans-serif, system-ui",
        },
      },
      {
        dark: {
          ...dark,
          primary: "#8B5CF6",
          fontFamily: "Inter, sans-serif, system-ui",
        },
      },
    ],
  },
};
