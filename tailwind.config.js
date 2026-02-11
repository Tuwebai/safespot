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
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Colores personalizados SafeSpot - Mapped to potential variables for theming, or kept static if brand identity
        // Converting these to variables too allows full theme switching
        "neon-green": "hsl(var(--neon-green))", // Was #00ff88 -> hsl(152, 100%, 50%)
        "neon-blue": "hsl(var(--neon-blue))",   // Was #0f172a -> hsl(222, 47%, 11%)
        "dark-bg": "hsl(var(--dark-bg))",       // Was #020617 -> hsl(222, 84%, 5%)
        "dark-card": "hsl(var(--dark-card))",   // Was #0f172a -> hsl(222, 47%, 11%)
        "dark-border": "hsl(var(--dark-border))", // Was #1e293b -> hsl(215, 32%, 17%)
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
            boxShadow: '0 0 5px hsl(var(--neon-green)), 0 0 10px hsl(var(--neon-green)), 0 0 15px hsl(var(--neon-green))',
          },
          '50%': {
            boxShadow: '0 0 10px hsl(var(--neon-green)), 0 0 20px hsl(var(--neon-green)), 0 0 30px hsl(var(--neon-green))',
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

