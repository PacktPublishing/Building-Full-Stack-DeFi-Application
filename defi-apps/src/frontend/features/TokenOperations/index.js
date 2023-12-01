import { useState, useEffect, useCallback } from 'react';
import { Button, Divider, Grid, Typography, useTheme, TextField } from '@mui/material';
import { localProvider } from '../../components/Wallet';
import { ethers } from 'ethers';
import TokenABI from '../../contracts/SimpleDeFiToken.json';
import TokenAddress from '../../contracts/SimpleDeFiToken-address.json';
import { useWeb3React } from "@web3-react/core";
import { toast } from 'react-toastify';

const TokenOperations = () => {
  const theme = useTheme();
  const { active, account, library } = useWeb3React();
  const [totalSupply, setTotalSupply] = useState(0);
  const [yourBalance, setYourBalance] = useState(0);
  const [addressNormal, setAddressNormal] = useState('');
  const [amountNormal, setAmountNormal] = useState(0);
  const [addressBurn, setAddressBurn] = useState('');
  const [amountBurn, setAmountBurn] = useState(0);

  const getTotalSupply = useCallback(async () => {
    try {
      const contract = new ethers.Contract(TokenAddress.address, TokenABI.abi, localProvider);
      const response = await contract.totalSupply();
      setTotalSupply(ethers.utils.formatEther(response));
    } catch (error) {
      console.error('Cannot get total supply', error);
    }
  }, []);

  const getYourBalance = useCallback(async () => {
    if (!active) return;
    try {
      let contract = new ethers.Contract(TokenAddress.address, TokenABI.abi, library.getSigner());
      const response = await contract.balanceOf(account);
      setYourBalance(ethers.utils.formatEther(response));
    } catch (error) {
      console.error('Cannot get your balance', error);
    }
  }, [account, library, active]);

  const handleTransfer = async (autoBurn) => {
    if (!active) {
      toast.error('You have to connect wallet first before transfer!');
      return;
    }

    const type = autoBurn ? 'auto burn' : 'normal';
    const address = autoBurn ? addressBurn : addressNormal;
    const amount = autoBurn ? amountBurn : amountNormal;

    if (!ethers.utils.isAddress(address)) {
      toast.error(`The recipient address for ${type} transfer is invalid!`);
      return;
    }
    if (isNaN(amount)) {
      toast.error(`The amount for ${type} transfer is invalid!`);
      return;
    }
    try {
      const contract = new ethers.Contract(TokenAddress.address, TokenABI.abi, library.getSigner());
      const tx = autoBurn ?
        await contract.transferWithAutoBurn(address, ethers.utils.parseUnits(amount, 'ether')) :
        await contract.transfer(address, ethers.utils.parseUnits(amount, 'ether'));
      toast.info(`Transaction Submitted! TxHash: ${tx.hash}`);
      await tx.wait();
      toast.info(`Transaction Succeeded! TxHash: ${tx.hash}`);
      if (autoBurn) {
        setAddressBurn('');
        setAmountBurn(0);
      } else {
        setAddressNormal('');
        setAmountNormal(0);
      }
      getTotalSupply();
      getYourBalance();
    } catch (error) {
      toast.error(`Cannot perform ${type} transfer!`);
      console.error(error);
    }
  }

  useEffect(() => {
    getTotalSupply();
    getYourBalance();
  }, [getTotalSupply, getYourBalance]);

  return <>
    <Grid container spacing={2}>
      <Grid item xs={12}><Typography variant='h6'>Simple DeFi Token</Typography></Grid>
      <Grid item xs={6}>
        <Typography variant='h6'>Total Supply</Typography>
        <Typography>{totalSupply}</Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant='h6'>Your Balance</Typography>
        <Typography>{yourBalance}</Typography>
      </Grid>
    </Grid>
    <Divider sx={theme.component.divider} />
    <Grid container spacing={2}>
      <Grid item xs={12}><Typography variant='h6'>Normal Transfer</Typography></Grid>
      <Grid item xs={12}>
        <TextField label="Please Enter Recipient's Address" value={addressNormal} fullWidth
          onChange={e => setAddressNormal(e.target.value)} />
      </Grid>
      <Grid item xs={12}>
        <TextField label="Please Enter Amount to transfer" value={amountNormal} fullWidth
          onChange={e => setAmountNormal(e.target.value)} />
      </Grid>
      <Grid item xs={12}>
        <Button sx={theme.component.primaryButton} fullWidth onClick={() => handleTransfer(false)}>
          Transfer!</Button>
      </Grid>
    </Grid>
    <Divider sx={theme.component.divider} />
    <Grid container spacing={2}>
      <Grid item xs={12}><Typography variant='h6'>Transfer with Burn</Typography></Grid>
      <Grid item xs={12}>
        <TextField label="Please Enter Recipient's Address" value={addressBurn} fullWidth
          onChange={e => setAddressBurn(e.target.value)} />
      </Grid>
      <Grid item xs={12}>
        <TextField label="Please Enter Amount to transfer (10% of tokens will be burnt automatically)" value={amountBurn} fullWidth
          onChange={e => setAmountBurn(e.target.value)} />
      </Grid>
      <Grid item xs={12}>
        <Button sx={theme.component.primaryButton} fullWidth onClick={() => handleTransfer(true)}>
          Transfer with Burn!</Button>
      </Grid>
    </Grid>
  </>;
};

export default TokenOperations;