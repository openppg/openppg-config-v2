const autoprefixer = require('autoprefixer');
const purgecss = require('@fullhuman/postcss-purgecss');
const whitelister = require('purgecss-whitelister');

module.exports = {
  plugins: [
    autoprefixer(),
    purgecss({
      content: [
        './layouts/**/*.html',
        './content/**/*.md',
        './content/**/*.html',
      ],
      safelist: {
        standard: [
          'lazyloaded',
          'version-selector',
          'hero-card__actions',
          'form-select',
          'badge',
          'bg-primary-subtle',
          'text-primary',
          'bg-secondary-subtle',
          'text-secondary',
          'fw-semibold',
          'release-card__list',
          'release-card__link',
          'release-card__meta',
          ...whitelister([
            './assets/scss/components/_code.scss',
            './assets/scss/components/_search.scss',
            './assets/scss/common/_dark.scss',
          ]),
        ],
        // The alert reference tables get their classes from Goldmark block
        // attributes ({.foo} in markdown), which PurgeCSS does not extract, and
        // they are only ever used in compound selectors. Greedy keeps the whole
        // rule rather than just the bare class.
        greedy: [/alert-thresholds/, /alert-critical-codes/],
      },
    }),
  ],
}
