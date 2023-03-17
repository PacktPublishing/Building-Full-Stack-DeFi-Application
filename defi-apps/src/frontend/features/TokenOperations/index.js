import { Button, Divider, Grid, Typography, useTheme, TextField } from '@mui/material';

const TokenOperations = () => {
  const theme = useTheme();

  return <>
    <Grid container spacing={2}>
      <Grid item xs={12}><Typography variant='h6'>Simple DeFi Token</Typography></Grid>
      <Grid item xs={6}>
        <Typography variant='h6'>Total Supply</Typography>
        <Typography>Total Supply</Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant='h6'>Your Balance</Typography>
        <Typography>Your Balance</Typography>
      </Grid>
    </Grid>
    <Divider sx={theme.component.divider} />
    <Grid container spacing={2}>
      <Grid item xs={12}><Typography variant='h6'>Normal Transfer</Typography></Grid>
      <Grid item xs={12}>
        <TextField label="Please Enter Recipient's Address" value={""} fullWidth />
      </Grid>
      <Grid item xs={12}>
        <TextField label="Please Enter Amount to transfer" value={""} fullWidth />
      </Grid>
      <Grid item xs={12}>
        <Button sx={theme.component.primaryButton} fullWidth>Transfer!</Button>
      </Grid>
    </Grid>
    <Divider sx={theme.component.divider} />
    <Grid container spacing={2}>
      <Grid item xs={12}><Typography variant='h6'>Transfer with Burn</Typography></Grid>
      <Grid item xs={12}>
        <TextField label="Please Enter Recipient's Address" value={""} fullWidth />
      </Grid>
      <Grid item xs={12}>
        <TextField label="Please Enter Amount to transfer (10% of tokens will be burnt automatically)" value={""} fullWidth />
      </Grid>
      <Grid item xs={12}>
        <Button sx={theme.component.primaryButton} fullWidth>Transfer with Burn!</Button>
      </Grid>
    </Grid>
  </>;
};

export default TokenOperations;