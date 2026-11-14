import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#070a12',
        panel: '#0f1419',
        'panel-elevated': '#161d29',
        border: '#1e293b',
        'border-subtle': '#334155',
        accent: '#00e6b8',
        'accent-dim': '#00a884',
        warn: '#f5c451',
        danger: '#f87171',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 0 0 1px rgba(148, 163, 184, 0.08), 0 24px 48px -24px rgba(0, 0, 0, 0.65)',
        glow: '0 0 32px -8px rgba(0, 230, 184, 0.35)',
      },
      backgroundImage: {
        mesh: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 230, 184, 0.12), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(99, 102, 241, 0.08), transparent)',
      },
    },
  },
  plugins: [],
};

export default config;
