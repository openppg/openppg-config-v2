const autoprefixer = require('autoprefixer');
const tailwindcss = require('tailwindcss');
const purgecss = require('@fullhuman/postcss-purgecss');

module.exports = {
  plugins: [
    tailwindcss('./tailwind.config.js'),
    autoprefixer(),
    purgecss({
      content: [
        './layouts/**/*.html',
        './content/**/*.{html,md}',
        './assets/js/**/*.js'
      ],
      safelist: [
        'show',
        'active',
        /^dropdown/,
        /^nav/,
        /^modal/,
        /^collapse/,
        /^bs-/,
        'open',
        'fade',
        'collapsing',
        /^tw-/  // Safelist all Tailwind classes
      ],
    }),
  ],
}
