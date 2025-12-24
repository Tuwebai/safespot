/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(220 13% 1%)",
        foreground: "hsl(210 40% 98%)",
        card: {
          DEFAULT: "hsl(220 13% 9%)",
          foreground: "hsl(210 40% 98%)",
        },
        primary: {
          DEFAULT: "hsl(142 100% 50%)",
          foreground: "hsl(220 13% 1%)",
        },
        secondary: {
          DEFAULT: "hsl(220 13% 9%)",
          foreground: "hsl(210 40% 98%)",
        },
        destructive: {
          DEFAULT: "hsl(0 84.2% 60.2%)",
          foreground: "hsl(210 40% 98%)",
        },
        muted: {
          DEFAULT: "hsl(220 13% 9%)",
          foreground: "hsl(215 20.2% 65.1%)",
        },
        accent: {
          DEFAULT: "hsl(220 13% 18%)",
          foreground: "hsl(210 40% 98%)",
        },
        border: "hsl(220 13% 18%)",
        input: "hsl(220 13% 18%)",
        ring: "hsl(142 100% 50%)",
        // Colores personalizados SafeSpot
        "neon-green": "#00ff88",
        "neon-blue": "#0f172a",
        "dark-bg": "#020617",
        "dark-card": "#0f172a",
        "dark-border": "#1e293b",
      },
      borderRadius: {
        lg: "0.5rem",
        md: "calc(0.5rem - 2px)",
        sm: "calc(0.5rem - 4px)",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        glow: {
          '0%, 100%': {
            boxShadow: '0 0 5px #00ff88, 0 0 10px #00ff88, 0 0 15px #00ff88',
          },
          '50%': {
            boxShadow: '0 0 10px #00ff88, 0 0 20px #00ff88, 0 0 30px #00ff88',
          },
        },
        'fade-in': {
          '0%': {
            opacity: '0',
            transform: 'translateY(10px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'slide-in': {
          '0%': {
            transform: 'translateX(-100%)',
          },
          '100%': {
            transform: 'translateX(0)',
          },
        },
        shimmer: {
          '0%': {
            backgroundPosition: '-200px 0',
          },
          '100%': {
            backgroundPosition: 'calc(200px + 100%) 0',
          },
        },
      },
      animation: {
        glow: 'glow 2s ease-in-out infinite alternate',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
}

