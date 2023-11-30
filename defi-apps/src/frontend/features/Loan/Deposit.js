import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useWeb3React } from "@web3-react/core";
import { Button, Divider, Grid, Typography, useTheme, TextField, IconButton, CircularProgress } from '@mui/material';
import { ethers } from 'ethers';
import { ERC20ABI } from '../../utils/ERC20ABI';
import { toast } from 'react-toastify';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { getTokenInfo, toString } from '../../utils/Helper';
import AssetPoolABI from '../../contracts/AssetPool.json';
import AssetPoolAddress from '../../contracts/AssetPool-address.json';

const Deposit = () => {
  const navigate = useNavigate();
  const [searchParam,] = useSearchParams();
  const theme = useTheme();
  const { active, account, library } = useWeb3React();
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState({});
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState(0);
  const [allow, setAllow] = useState(0);

  const getBalance = useCallback(async tokenObject => {
    try {
      const tokenContract = new ethers.Contract(tokenObject.address, ERC20ABI, library.getSigner());
      const _balance = await tokenContract.balanceOf(account);
      setBalance(Number(ethers.utils.formatUnits(_balance, tokenObject.decimals)));
    } catch (error) {
      toast.error("Cannot get token balance for deposit!");
      console.error(error);
    }
  }, [library, account]);

  const checkAllowance = useCallback(async tokenObject => {
    try {
      const tokenContract = new ethers.Contract(tokenObject.address, ERC20ABI, library.getSigner());
      let _allow = await tokenContract.allowance(account, AssetPoolAddress.address);
      setAllow(Number(ethers.utils.formatUnits(_allow, tokenObject.decimals)));
    } catch (error) {
      toast.error("Cannot get allowance for token!");
      console.error(error);
    }
  }, [account, library]);

  const loadDepositInfo = useCallback(async tokenAddress => {
    setLoading(true);
    try {
      const tokenObject = await getTokenInfo(tokenAddress);
      setToken(tokenObject);
      await getBalance(tokenObject);
      await checkAllowance(tokenObject);
    } catch (error) {
      toast.error("Failed to load information for deposit!");
      console.log(error);
    }
    setLoading(false);
  }, [getBalance, checkAllowance]);

  const handleChange = e => {
    let tmpVal = e.target.value ? e.target.value : 0;
    if (tmpVal < 0 || isNaN(tmpVal)) {
      return;
    } else if (!(typeof tmpVal === 'string' && (tmpVal.endsWith(".") || tmpVal.startsWith(".")))) {
      tmpVal = Number(e.target.value.toString());
    }
    setAmount(tmpVal);
  }

  const handleApprove = async () => {
    setLoading(true);
    try {
      const tokenContract = new ethers.Contract(token.address, ERC20ABI, library.getSigner());
      const allowAmount = ethers.utils.parseUnits(toString(amount), token.decimals);
      const tx = await tokenContract.approve(AssetPoolAddress.address, allowAmount);
      await tx.wait()
      toast.info("Deposit amount is approved!");
      await checkAllowance(token);
    } catch (error) {
      toast.error("Cannot approve the deposited amount!");
      console.error(error);
    }
    setLoading(false);
  }

  const handleDeposit = async () => {
    setLoading(true);
    try {
      const assetPool = new ethers.Contract(AssetPoolAddress.address, AssetPoolABI.abi, library.getSigner());
      const tx = await assetPool.deposit(token.address, ethers.utils.parseUnits(toString(amount), token.decimals));
      await tx.wait();
      toast.info(`Deposit token successfully! Transaction hash: ${tx.hash}`);
      setAmount(0);
      await checkAllowance(token);
      await getBalance(token);
    } catch (error) {
      toast.error("Cannot deposit token!");
      console.log(error);
    }
    setLoading(false);
  }

  useEffect(() => {
    const tokenAddress = searchParam.get('token');
    if (active && tokenAddress) {
      loadDepositInfo(tokenAddress);
    }
  }, [active, loadDepositInfo, searchParam]);

  if (!active) {
    return <Typography>Please connect to a wallet to deposit</Typography>;
  } else if (Object.keys(token).length === 0) {
    return <Typography>Please provide valid token in asset pool in URL</Typography>
  }

  return <Grid container>
    <Grid item>
      <Grid container columnGap={12}>
        <Grid item>
          <IconButton onClick={() => { navigate('..', { replace: true }) }}>
            <ArrowBackIcon />
          </IconButton>
        </Grid>
        <Grid item>
          <Typography sx={{ mt: 1 }}>Make Deposit</Typography>
        </Grid>
      </Grid>
      <Divider sx={theme.component.divider} />
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Typography sx={{ mt: 2 }}>Amount to Deposit</Typography>
        </Grid>
        <Grid item xs={6}>
          <TextField label={`Please enter amount of ${token.symbol}`} value={amount} onChange={handleChange} fullWidth />
          <Typography sx={theme.component.hintText}>Balance of {token.symbol}: {balance}</Typography>
          <Button sx={{ fontSize: 12, padding: '0px' }} onClick={() => setAmount(balance)} >Max</Button>
        </Grid>
        <Grid item xs={6}>
          <Button disabled={amount <= 0 || allow >= amount} sx={theme.component.primaryButton} fullWidth onClick={handleApprove}>
            {loading ? <CircularProgress sx={{ color: 'white' }} /> : "Approve"}
          </Button>
        </Grid>
        <Grid item xs={6}>
          <Button disabled={amount <= 0 || allow < amount || amount > balance} sx={theme.component.primaryButton} fullWidth
            onClick={handleDeposit}>
            {loading ? <CircularProgress sx={{ color: 'white' }} /> : "Deposit"}
          </Button>
        </Grid>
      </Grid>
    </Grid>
  </Grid>;
};

export default Deposit;