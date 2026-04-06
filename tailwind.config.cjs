/** @type {import('tailwindcss').Config} */
module.exports = {
  // 1. Most important: Make sure it scans all your code files
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}", // Add this line for safety
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}", // If you have hooks directory
    "./lib/**/*.{js,ts,jsx,tsx,mdx}", // If you have lib directory
  ],
  darkMode: "class", 
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        heading: ["var(--font-manrope)", "sans-serif"],
      },
      colors: {
        primary: "#ef4444",
      },
    },
  },
  plugins: [],
};