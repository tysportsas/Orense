import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        green: '#14532d',
        turf: '#1f7a45',
        tint: '#e2eee3',
        gold: '#b58a1e',
        goldSoft: '#f6eccf',
        ink: '#14211a',
        muted: '#56655b',
        line: '#d3dbd0',
        surface: '#ffffff',
        surface2: '#f3f6f1',
        bg: '#edf1ea'
      },
      fontFamily: {
        display: ['"Barlow Condensed"', '"Arial Narrow"', 'sans-serif'],
        sans: ['Barlow', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
