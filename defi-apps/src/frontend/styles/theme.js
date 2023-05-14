import { createTheme } from "@mui/material";

export const theme = createTheme({
  layout: {
    flex: {
      display: 'flex',
    },
    iconButton: {
      mr: 2, display: { sm: 'none' }
    },
    titleLaptop: {
      flexGrow: 1, display: { xs: 'none', sm: 'block' },
    },
    titleMobile: { my: 2 },
    menuBar: { display: { xs: 'none', sm: 'block' }, marginRight: 4 },
  },
  component: {
    divider: {
      my: 2,
    },
    menuButton: {
      color: '#fff',
      borderBottom: "1px solid #fff",
      marginLeft: 2,
      borderRadius: 0,
    },
    primaryButton: {
      border: "1px solid #fff",
      color: '#fff',
      backgroundColor: '#1976d2',
      height: '50px',
      "&:hover": {
        backgroundColor: '#333',
      }
    },
    selectButton: {
      minWidth: 'max-content',
      textTransform: 'none',
      height: '50px',
      border: "1px solid #1976d2",
    },
    hintText: {
      fontSize: '12px'
    },
  }
});