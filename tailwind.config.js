/** @type {import('tailwindcss').Config} */
module.exports = {
  // 1. Quan trọng nhất: Đảm bảo nó quét đủ các file code của bạn
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}", // Thêm dòng này cho chắc
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}", // Nếu có thư mục hooks
    "./lib/**/*.{js,ts,jsx,tsx,mdx}", // Nếu có thư mục lib
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