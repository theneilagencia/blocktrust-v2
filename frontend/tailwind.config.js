/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // BTS Design System - Primary Brand Colors
        primary: {
          white: '#FFFFFF',
          black: '#000000',
          blue: '#1B3857',
          blueHighlight: '#1B5AB4',
        },
        
        // BTS Design System - Secondary Colors
        secondary: {
          blueC01: '#1B3857',
          blueC02: '#1B4668',
          blue503: '#0C80A5',
          blueC04: '#2A7BA1',
          blue505: '#63C9F3',
          gray506: '#B2B2B2',
        },
        
        // BTS Design System - Neutral Colors
        neutral: {
          50: '#FFFFFF',
          100: '#E4E4E4',
          200: '#C9C9C9',
          300: '#C6C6C6',
          400: '#9B9B9B',
          500: '#595757',
          900: '#333333',
        },
        
        // BTS Design System - Feedback Colors
        success: {
          50: '#B1D2B1',
          100: '#8CC28C',
          500: '#2E8B2E',
          600: '#1A661A',
          700: '#0D330D',
          900: '#073307',
        },
        
        warning: {
          50: '#FFF4D1',
          100: '#FFE6A4',
          500: '#FFD700',
          600: '#B39600',
          700: '#665500',
          900: '#332B00',
        },
        
        error: {
          50: '#F9B6B6',
          100: '#F48C8C',
          500: '#E63939',
          600: '#A32929',
          700: '#5C1717',
          900: '#2E0C0C',
        },
        
        info: {
          50: '#63C9F3',
          100: '#2A7BA1',
          500: '#0C80A5',
          600: '#1B4668',
          700: '#1B3857',
          900: '#1B3857',
        },
        
        // BTS Design System - Text Colors
        text: {
          primary: '#000000',
          secondary: '#333333',
          tertiary: '#595757',
          disabled: '#9B9B9B',
          inverse: '#FFFFFF',
          link: '#1B5AB4',
          linkHover: '#1B3857',
        },
        
        // BTS Design System - Background Colors
        background: {
          default: '#FFFFFF',
          paper: '#E4E4E4',
          elevated: '#FFFFFF',
          dark: '#1B3857',
          light: '#C9C9C9',
          accent: '#63C9F3',
        },
        
        // BTS Design System - Border Colors
        border: {
          DEFAULT: '#C6C6C6',
          light: '#E4E4E4',
          dark: '#9B9B9B',
          focus: '#1B5AB4',
          divider: '#B2B2B2',
        },
        
        // Legacy brand colors (manter compatibilidade)
        brand: {
          navy: '#1B3857',
          blue: '#1B5AB4',
          neutral: '#333333',
          accent: '#63C9F3',
        },
      },
      
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Montserrat', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      
      animation: {
        'fade-in': 'fadeIn 0.6s ease-in-out',
        'slide-in-left': 'slideInLeft 0.8s ease-out',
        'slide-in-right': 'slideInRight 0.8s ease-out',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient-shift': 'gradientShift 15s ease infinite',
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.9' },
        },
        gradientShift: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
      
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '100': '25rem',
        '112': '28rem',
        '128': '32rem',
      },
      
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },
      
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 10px 40px -10px rgba(0, 0, 0, 0.1)',
        'bts': '0 4px 6px -1px rgba(27, 56, 87, 0.1), 0 2px 4px -1px rgba(27, 56, 87, 0.06)',
        'bts-lg': '0 10px 15px -3px rgba(27, 56, 87, 0.1), 0 4px 6px -2px rgba(27, 56, 87, 0.05)',
      },
      
      borderRadius: {
        '4xl': '2rem',
      },
      
      transitionDuration: {
        '400': '400ms',
      },
    },
  },
  plugins: [],
}
