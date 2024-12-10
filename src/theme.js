// src/theme.js

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#808080',
    },
    text: {
      primary: '#000000',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: 'Amatic, sans-serif',
    h4: {
      fontWeight: 700,
    },
    body1: {
      fontWeight: 400,
    },
  },
  components: {
    MuiTypography: {
      styleOverrides: {
        root: {
          fontFamily: 'Amatic, sans-serif',
        },
      },
    },
  },
});

export default theme;