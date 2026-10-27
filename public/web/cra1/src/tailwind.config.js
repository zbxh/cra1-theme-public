const path = require('path');
const daisyui = require('daisyui');
const flowbite = require('flowbite/plugin');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.resolve(__dirname, '../**/*.html'),
    '!' + path.resolve(__dirname, '../**/node_modules/**'),
    '!' + path.resolve(__dirname, '../releases/**'),
    '!' + path.resolve(__dirname, '../**/*preview*'),
    path.resolve(__dirname, '../assets/js/**/*.js'),
    '!' + path.resolve(__dirname, '../assets/js/component-backgrounds.js'),
    // 服务端预构建的 HTML 片段（页脚/模块占位等）在 controller/*.php 里，
    // 不纳入扫描会导致 mb-3 / py-7 / w-9 / shadow-sm 等类缺失
    path.resolve(__dirname, '../controller/**/*.php'),
  ],
  theme: {
    container: { center: true, padding: '1.25rem' },
    extend: {
      screens: {
        nav: '62rem',
      },
      colors: {
        ink: 'rgb(from var(--cui-ink) r g b / <alpha-value>)',
        body: 'rgb(from var(--cui-body) r g b / <alpha-value>)',
        muted: 'rgb(from var(--cui-muted) r g b / <alpha-value>)',
        brand: 'rgb(from var(--cui-brand) r g b / <alpha-value>)',
        'brand-hover': 'rgb(from var(--cui-brand-hover) r g b / <alpha-value>)',
        surface: 'rgb(from var(--cui-surface) r g b / <alpha-value>)',
        'surface-alt': 'rgb(from var(--cui-accent) r g b / <alpha-value>)',
        line: 'rgb(from var(--cui-line) r g b / <alpha-value>)',
        success: '#07835E',
        warning: '#B45309',
        danger: '#B42318',
        /* v2.51 深色 sheet（页脚 AWS 化）：与 src/app.css :root 的 --night-* 同源登记 */
        night: {
          DEFAULT: 'rgb(from var(--cui-night) r g b / <alpha-value>)',
          ink: 'rgb(from var(--cui-night-ink) r g b / <alpha-value>)',
          body: 'rgb(from var(--cui-night-body) r g b / <alpha-value>)',
          muted: 'rgb(from var(--cui-night-muted) r g b / <alpha-value>)',
          line: 'rgba(255,255,255,0.10)',
          brand: 'rgb(from var(--cui-highlight) r g b / <alpha-value>)',
          'btn-ink': 'rgb(from var(--cui-white) r g b / <alpha-value>)',
          raised: 'rgb(from var(--cui-night-raised) r g b / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--cui-font)'],
      },
      boxShadow: {
        card: 'var(--cui-shadow-card)',
        'card-hover': 'var(--cui-shadow-pop)',
        hero: '0 18px 40px color-mix(in srgb,var(--cui-night) 22%,transparent)',
      },
      maxWidth: {
        content: '80rem',
      },
      backgroundImage: {
        'hero-grid': 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)',
      },
    },
  },
  daisyui: {
    themes: [
      {
        cra1: {
          primary: '#35383c',
          'primary-content': '#FFFFFF',
          secondary: '#61656b',
          'secondary-content': '#FFFFFF',
          accent: '#0E9F6E',
          'accent-content': '#FFFFFF',
          neutral: '#2b2f34',
          'neutral-content': '#eef0f1',
          'base-100': '#FFFFFF',
          'base-200': '#eef0f1',
          'base-300': '#d8dde1',
          'base-content': '#2b2f34',
          info: '#35383c',
          success: '#07835E',
          warning: '#B45309',
          error: '#B42318',
          '--rounded-box': '0.5rem',
          '--rounded-btn': '0.375rem',
          '--rounded-badge': '999px',
        },
      },
    ],
    logs: false,
  },
  plugins: [daisyui, flowbite],
};
