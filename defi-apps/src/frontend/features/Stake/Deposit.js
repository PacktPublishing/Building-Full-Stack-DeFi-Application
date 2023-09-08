import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useWeb3React } from "@web3-react/core";
import { Button, Divider, Grid, Typography, useTheme, TextField, IconButton, CircularProgress } from '@mui/material';
import { ethers } from 'ethers';
import { ERC20ABI } from '../../utils/ERC20ABI';
import { StakingPoolABI } from '../../utils/StakingPoolABI';
import { toast } from 'react-toastify';
import { getTokenInfo, toString } from '../../utils/Helper';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const Deposit = () => {
  const navigate = useNavigate();
  const [searchParam,] = useSearchParams();
  const theme = useTheme();
  const { active, account, library } = useWeb3React();
  const [stakingPoolAddress, setStakingPoolAddress] = useState('');
  const [stakedToken, setStakedToken] = useState({});
  const [balance, setBalance] = useState(0);
  const [allow, setAllow] = useState(false);
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  const getStakedToken = useCallback(async (poolAddress) => {
    if (Object.keys(stakedToken).length > 0) {
      return;
    }
    try {
      const stakingPool = new ethers.Contract(poolAddress, StakingPoolABI, library.getSigner());
      const _stakedToken = await getTokenInfo(await stakingPool.stakedToken());
      setStakedToken(_stakedToken);
      setStakingPoolAddress(poolAddress);
    } catch (error) {
      toast.error(`Cannot get the information of staked token with staking pool address ${poolAddress}!`);
      console.error(error);
    }
  }, [library, stakedToken]);

  const getBalance = useCallback(async () => {
    if (stakingPoolAddress === '') return;
    try {
      const tokenContact = new ethers.Contract(stakedToken.address, ERC20ABI, library.getSigner());
      const _balance = await tokenContact.balanceOf(account);
      setBalance(Number(ethers.utils.formatUnits(_balance, stakedToken.decimals)));
    } catch (error) {
      toast.error('Cannot get balance for staked token!');
      console.error(error);
    }
  }, [account, library, stakedToken, stakingPoolAddress]);

  const checkAllowance = useCallback(async () => {
    if (stakingPoolAddress === '') return;
    try {
      const tokenContract = new ethers.Contract(stakedToken.address, ERC20ABI, library.getSigner());
      let _allow = await tokenContract.allowance(account, stakingPoolAddress);
      setAllow(Number(ethers.utils.formatUnits(_allow, stakedToken.decimals)));
    } catch (error) {
      toast.error('Cannot get allowance for staked token!');
      console.error(error);
    }
  }, [account, library, stakedToken, stakingPoolAddress]);

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
      const tokenContract = new ethers.Contract(stakedToken.address, ERC20ABI, library.getSigner());
      const allowAmount = ethers.utils.parseUnits(toString(amount), stakedToken.decimals)
      const tx = await tokenContract.approve(stakingPoolAddress, allowAmount);
      await tx.wait();
      toast.info('Deposit is approved!');
      await checkAllowance();
    } catch (error) {
      toast.error("Cannot approve staked token!");
      console.error(error);
    }
    setLoading(false);
  }

  const handleDeposit = async () => {
    if (stakingPoolAddress === '') {
      toast.error("Staking pool not found!");
      return;
    }
    setLoading(true);
    try {
      const stakingPool = new ethers.Contract(stakingPoolAddress, StakingPoolABI, library.getSigner());
      const tx = await stakingPool.deposit(ethers.utils.parseUnits(toString(amount), stakedToken.decimals));
      await tx.wait();
      toast.info(`Deposit token successfully! Transaction hash: ${tx.hash}`);
      setAmount(0);
      await checkAllowance();
      await getBalance();
    } catch (error) {
      toast.error("Cannot deposit staked token!");
      console.error(error);
    }
    setLoading(false);
  }

  useEffect(() => {
    const poolAddress = searchParam.get('pool');
    if (active && poolAddress) {
      getStakedToken(poolAddress);
      checkAllowance();
      getBalance();
    }
  }, [active, getBalance, getStakedToken, checkAllowance, searchParam]);

  if (!active) {
    return <Typography>Please connect to a wallet to stake</Typography>;
  } else if (Object.keys(stakedToken).length === 0) {
    return <Typography>Please provide valid "pool" search parameter in URL</Typography>
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
          <Typography sx={{ mt: 1 }}>Deposit Staked Token ({stakedToken.symbol})</Typography>
        </Grid>
      </Grid>
      <Divider sx={theme.component.divider} />
      <Grid container spacing={2}>
        <Grid item xs={4}>
          <Typography sx={{ mt: 2 }}>Amount to Deposit</Typography>
        </Grid>
        <Grid item xs={8}>
          <TextField label={`Please enter staked token (${stakedToken.symbol}) amount`} value={amount}
            onChange={handleChange} fullWidth />
          <Typography sx={theme.component.hintText}>Balance of {stakedToken.symbol}: {balance}</Typography>
          <Button sx={{ fontSize: 12, padding: '0px' }} onClick={() => setAmount(balance)} >Max</Button>
        </Grid>
        <Grid item xs={6}>
          <Button disabled={amount <= 0 || allow >= amount} sx={theme.component.primaryButton} fullWidth onClick={() => handleApprove()} >
            {allow < amount && loading ? <CircularProgress sx={{ color: 'white' }} /> : "Approve"}
          </Button>
        </Grid>
        <Grid item xs={6}>
          <Button disabled={amount <= 0 || allow < amount || amount > balance} sx={theme.component.primaryButton} fullWidth onClick={() => handleDeposit()}>
            {allow >= amount && loading ? <CircularProgress sx={{ color: 'white' }} /> : "Deposit"}
          </Button>
        </Grid>
      </Grid>
    </Grid>
  </Grid>
}
export default Deposit;