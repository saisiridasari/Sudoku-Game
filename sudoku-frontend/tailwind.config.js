/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        sudoku: {
          original: '#f8fafc',
          user: '#ffffff',
          border: '#1e293b',
          focus: '#e0f2fe',
          text: '#334155',
          userText: '#0ea5e9'
        }
      },
      boxShadow: {
        'sudoku': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'sudoku-focus': '0 0 0 3px rgba(59, 130, 246, 0.1)'
      }
    }
  },
  plugins: []
}
