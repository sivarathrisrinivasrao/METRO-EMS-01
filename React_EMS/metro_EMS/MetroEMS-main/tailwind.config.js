/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
       colors: {
         primary: "hsl(197.33deg 26.63% 66.86%)",
         card: "hsl(0deg 0% 100%)",
        // text: "#1F2937",
        text: "hsl(0deg 0% 0%)",
        buttonPrimary: "hsl(205.5deg 75% 68.63%)",
        buttonSecondary: "hsl(211.58deg 9.36% 60.2%)",
        buttonTertiary: "hsl(211.65deg 40.81% 43.73%)",
        input: "hsl(0deg 2.33% 83.14%)",
      },
    },
  },
  plugins: [],
};