/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 时间紧迫度颜色
        urgency: {
          normal: '#22c55e',  // 绿色 >12小时
          warning: '#eab308', // 黄色 6-12小时
          alert: '#f97316',   // 橙色 2-6小时
          urgent: '#ef4444',  // 红色 <2小时
        },
      },
    },
  },
  plugins: [],
}
