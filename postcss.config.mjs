/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-preset-env': {
      stage: 2,
      browsers: 'Safari >= 13, iOS >= 13, Chrome >= 80, Firefox >= 78',
      features: {
        'oklab-function': { preserve: false },
        'color-mix': { preserve: false },
        'cascade-layers': true,
      },
    },
    autoprefixer: {
      overrideBrowserslist: [
        'Safari >= 13',
        'iOS >= 13',
        'Chrome >= 80',
        'Firefox >= 78',
      ],
    },
  },
};

export default config;

