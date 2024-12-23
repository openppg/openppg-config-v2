/** @type {import('tailwindcss').Config} */
module.exports = {
  prefix: 'tw-',
  content: [
    './layouts/**/*.html',
    './content/**/*.{html,md}',
    './assets/js/**/*.js',
    './assets/scss/**/*.scss'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#007bff',
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  important: true,
  plugins: [],
}

