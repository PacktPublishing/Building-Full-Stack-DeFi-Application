import * as React from 'react';
import {
  AppBar, Box, Divider, Drawer, IconButton, List, ListItem, ListItemButton,
  ListItemText, Menu, MenuItem, Toolbar, Tooltip, Typography, Button, Grid, useTheme
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Link } from "react-router-dom";
import { useWeb3React } from "@web3-react/core";
import { injectedConnector, walletConnectConnector } from "../Wallet";
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PopupState, { bindTrigger, bindMenu } from 'material-ui-popup-state';

const drawerWidth = 240;
const navItems = [{
  title: 'Token Operations',
  link: '/'
}, {
  title: 'Liquidity',
  link: '/liquidity'
}, {
  title: 'Swap',
  link: '/swap'
}, {
  title: 'Stake',
  link: '/stake'
}, {
  title: 'Farm',
  link: '/farm'
}, {
  title: 'Loan',
  link: '/loan'
}];
const appName = 'DeFi Application';

const Layout = ({ children }) => {
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { active, account, activate, deactivate } = useWeb3React();

  const connect = async (connector) => {
    try {
      await activate(connector);
    } catch (error) {
      console.error(error);
    }
  };

  const disconnect = async () => {
    try {
      await deactivate();
    } catch (error) {
      console.error(error);
    }
  }

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
        {navItems.map((item, index) => (
          <ListItem key={`menu-item-${index}`} disablePadding component={Link} to={item.link}>
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
          {navItems.map((item, index) => (
            <Button key={`menu-${index}`} sx={theme.component.menuButton} component={Link} to={item.link}>
              {item.title}
            </Button>
          ))}
        </Box>
        <Box>
          {active ? <Tooltip title="Click to disconnect from wallet">
            <Button sx={theme.component.primaryButton} onClick={disconnect} >
              <AccountBalanceWalletIcon />{`${account.substring(0, 6)}...${account.substring(38)}`}
            </Button>
          </Tooltip> :
            <PopupState variant="popover" popupId="popup-select-connector">
              {popupState => <React.Fragment>
                <Tooltip title="Select one type of wallet connectors to start connecting your wallet">
                  <Button variant="contained" {...bindTrigger(popupState)}>
                    Wallet Connectors
                </Button>
                </Tooltip>
                <Menu {...bindMenu(popupState)}>
                  <MenuItem onClick={() => { connect(injectedConnector); popupState.close(); }}>Injected</MenuItem>
                  <MenuItem onClick={() => { connect(walletConnectConnector); popupState.close(); }}>Wallet Connect</MenuItem>
                </Menu>
              </React.Fragment>}
            </PopupState>
          }
        </Box>
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