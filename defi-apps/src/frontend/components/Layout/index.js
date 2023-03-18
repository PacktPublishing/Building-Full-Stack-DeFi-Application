import * as React from 'react';
import {
  AppBar, Box, Divider, Drawer, IconButton, List, ListItem, ListItemButton,
  ListItemText, Toolbar, Typography, Button, Grid, useTheme
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Link } from "react-router-dom";

const drawerWidth = 240;
const navItems = [{
  title: 'Token Operations',
  link: '/'
}];
const appName = 'DeFi Application';

const Layout = ({ children }) => {
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(prevState => !prevState);
  };
  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
      <Typography variant="h6" sx={theme.layout.titleMobile}>
        {appName}
      </Typography>
      <Divider />
      <List>
        {navItems.map((item) => (
          <ListItem key={item} disablePadding component={Link} to={item.link}>
            <ListItemButton sx={{ textAlign: 'center' }}>
              <ListItemText primary={item.title} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return <Box sx={theme.layout.flex}>
    <AppBar component="nav">
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={handleDrawerToggle}
          sx={theme.layout.iconButton}
        >
          <MenuIcon />
        </IconButton>
        <Typography
          variant="h6"
          component="div"
          sx={theme.layout.titleLaptop}
        >
          {appName}
        </Typography>
        <Box sx={theme.layout.menuBar}>
          {navItems.map((item) => (
            <Button key={item} sx={theme.component.menuButton} component={Link} to={item.link}>
              {item.title}
            </Button>
          ))}
        </Box>
        <Box><Button sx={theme.component.primaryButton}>Connect Wallet</Button></Box>
      </Toolbar>
    </AppBar>
    <Box component="nav">
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
      >
        {drawer}
      </Drawer>
    </Box>
    <Box component="main" sx={{ p: 3 }}>
      <Toolbar />
      <Grid item>{children}</Grid>
    </Box>
  </Box>;
}

export default Layout;