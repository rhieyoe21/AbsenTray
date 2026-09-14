module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-in',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    // Custom identity: cool-slate base + teal actions (attendance "on-site").
    // Dark uses a deep navy ink instead of pure black.
    themes: [
      {
        absen: {
          "primary": "#0F766E",
          "primary-content": "#FFFFFF",
          "secondary": "#475569",
          "secondary-content": "#F8FAFC",
          "accent": "#0EA5E9",
          "accent-content": "#082F49",
          "neutral": "#64748B",
          "neutral-content": "#F8FAFC",
          "base-100": "#FFFFFF",
          "base-200": "#F1F5F9",
          "base-300": "#E2E8F0",
          "base-content": "#0F172A",
          "info": "#0284C7",
          "info-content": "#FFFFFF",
          "success": "#15803D",
          "success-content": "#FFFFFF",
          "warning": "#A16207",
          "warning-content": "#FFFFFF",
          "error": "#B91C1C",
          "error-content": "#FFFFFF",
        },
      },
      {
        absenDark: {
          "primary": "#2DD4BF",
          "primary-content": "#042F2E",
          "secondary": "#94A3B8",
          "secondary-content": "#0B1220",
          "accent": "#38BDF8",
          "accent-content": "#082F49",
          "neutral": "#1E293B",
          "neutral-content": "#E2E8F0",
          "base-100": "#0B1220",
          "base-200": "#111A2E",
          "base-300": "#1C2740",
          "base-content": "#E2E8F0",
          "info": "#38BDF8",
          "info-content": "#082F49",
          "success": "#4ADE80",
          "success-content": "#052E16",
          "warning": "#FBBF24",
          "warning-content": "#451A03",
          "error": "#F87171",
          "error-content": "#450A0A",
        },
      },
    ],
    darkTheme: "absenDark",
    base: true,
    styled: true,
    utils: true,
  },
}