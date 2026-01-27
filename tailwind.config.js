/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    // 1. 扫描根目录下的文件 (例如 App.tsx, index.tsx)
    "./*.{js,ts,jsx,tsx}",

    // 2. 扫描你所有的子文件夹 (根据你之前发的文件结构)
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    // 如果还有其他文件夹，继续在这里添加
  ],
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {},
  },
  plugins: [],
}
