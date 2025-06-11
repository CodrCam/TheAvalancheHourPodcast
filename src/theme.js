// src/theme.js
import { createTheme } from '@mui/material/styles';

// Custom color palette inspired by mountain/snow themes
const palette = {
  primary: {
    main: '#1976d2', // Mountain blue
    light: '#42a5f5',
    dark: '#1565c0',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#f57c00', // Warm orange/amber for accent
    light: '#ffb74d',
    dark: '#e65100',
    contrastText: '#ffffff',
  },
  background: {
    default: '#fafafa',
    paper: '#ffffff',
  },
  text: {
    primary: '#2c3e50',
    secondary: '#546e7a',
  },
  grey: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },
  // Custom colors for the avalanche theme
  avalanche: {
    snow: '#ffffff',
    ice: '#e3f2fd',
    danger: '#d32f2f',
    warning: '#ff9800',
    safe: '#4caf50',
  }
};

// Typography system
const typography = {
  fontFamily: [
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
  ].join(','),
  
  // Custom font for headings
  h1: {
    fontFamily: '"Amatic SC", cursive',
    fontWeight: 700,
    fontSize: '3.5rem',
    lineHeight: 1.2,
    letterSpacing: '0.02em',
    '@media (max-width:600px)': {
      fontSize: '2.5rem',
    },
  },
  h2: {
    fontFamily: '"Amatic SC", cursive',
    fontWeight: 700,
    fontSize: '3rem',
    lineHeight: 1.3,
    letterSpacing: '0.02em',
    '@media (max-width:600px)': {
      fontSize: '2.2rem',
    },
  },
  h3: {
    fontFamily: '"Amatic SC", cursive',
    fontWeight: 700,
    fontSize: '2.5rem',
    lineHeight: 1.3,
    '@media (max-width:600px)': {
      fontSize: '2rem',
    },
  },
  h4: {
    fontFamily: '"Amatic SC", cursive',
    fontWeight: 700,
    fontSize: '2rem',
    lineHeight: 1.4,
    '@media (max-width:600px)': {
      fontSize: '1.75rem',
    },
  },
  h5: {
    fontWeight: 600,
    fontSize: '1.5rem',
    lineHeight: 1.4,
    color: palette.text.primary,
  },
  h6: {
    fontWeight: 600,
    fontSize: '1.25rem',
    lineHeight: 1.4,
    color: palette.text.primary,
  },
  body1: {
    fontSize: '1rem',
    lineHeight: 1.6,
    color: palette.text.primary,
  },
  body2: {
    fontSize: '0.875rem',
    lineHeight: 1.5,
    color: palette.text.secondary,
  },
  button: {
    fontWeight: 600,
    textTransform: 'none',
    fontSize: '1rem',
  },
  caption: {
    fontSize: '0.75rem',
    lineHeight: 1.4,
    color: palette.text.secondary,
  },
};

// Component customizations
const components = {
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        textTransform: 'none',
        fontWeight: 600,
        padding: '12px 24px',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        },
      },
      contained: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        '&:hover': {
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        },
      },
      outlined: {
        borderWidth: '2px',
        '&:hover': {
          borderWidth: '2px',
        },
      },
    },
  },
  
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        },
      },
    },
  },
  
  MuiCardContent: {
    styleOverrides: {
      root: {
        padding: '24px',
        '&:last-child': {
          paddingBottom: '24px',
        },
      },
    },
  },
  
  MuiAppBar: {
    styleOverrides: {
      root: {
        backgroundColor: palette.primary.main,
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
      },
    },
  },
  
  MuiToolbar: {
    styleOverrides: {
      root: {
        minHeight: '72px',
        '@media (min-width: 600px)': {
          minHeight: '72px',
        },
      },
    },
  },
  
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        fontWeight: 500,
      },
      outlined: {
        borderWidth: '1.5px',
      },
    },
  },
  
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 8,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: palette.primary.light,
          },
        },
      },
    },
  },
  
  MuiContainer: {
    styleOverrides: {
      root: {
        paddingLeft: '16px',
        paddingRight: '16px',
        '@media (min-width: 600px)': {
          paddingLeft: '24px',
          paddingRight: '24px',
        },
      },
    },
  },
  
  // Custom loading component styles
  MuiCircularProgress: {
    styleOverrides: {
      root: {
        animationDuration: '1.4s',
      },
    },
  },
  
  // Link styles
  MuiLink: {
    styleOverrides: {
      root: {
        color: palette.primary.main,
        textDecoration: 'none',
        transition: 'color 0.2s ease-in-out',
        '&:hover': {
          color: palette.primary.dark,
          textDecoration: 'underline',
        },
      },
    },
  },
};

// Custom breakpoints for responsive design
const breakpoints = {
  values: {
    xs: 0,
    sm: 600,
    md: 900,
    lg: 1200,
    xl: 1536,
  },
};

// Spacing system
const spacing = 8; // Base spacing unit

// Create the theme
const theme = createTheme({
  palette,
  typography,
  components,
  breakpoints,
  spacing,
  
  // Custom theme extensions
  shape: {
    borderRadius: 8,
  },
  
  // Custom shadows for depth
  shadows: [
    'none',
    '0px 1px 3px rgba(0, 0, 0, 0.12), 0px 1px 2px rgba(0, 0, 0, 0.24)',
    '0px 3px 6px rgba(0, 0, 0, 0.16), 0px 3px 6px rgba(0, 0, 0, 0.23)',
    '0px 10px 20px rgba(0, 0, 0, 0.19), 0px 6px 6px rgba(0, 0, 0, 0.23)',
    '0px 14px 28px rgba(0, 0, 0, 0.25), 0px 10px 10px rgba(0, 0, 0, 0.22)',
    '0px 19px 38px rgba(0, 0, 0, 0.30), 0px 15px 12px rgba(0, 0, 0, 0.22)',
    // Add more shadow levels as needed...
    ...Array(19).fill('0px 19px 38px rgba(0, 0, 0, 0.30), 0px 15px 12px rgba(0, 0, 0, 0.22)'),
  ],
  
  // Z-index system
  zIndex: {
    mobileStepper: 1000,
    speedDial: 1050,
    appBar: 1100,
    drawer: 1200,
    modal: 1300,
    snackbar: 1400,
    tooltip: 1500,
  },
  
  // Transitions
  transitions: {
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
      complex: 375,
      enteringScreen: 225,
      leavingScreen: 195,
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
    },
  },
});

export default theme;