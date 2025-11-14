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
      safelist: [
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
    }),
  ],
}
