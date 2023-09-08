import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useWeb3React } from "@web3-react/core";
import { Button, Divider, Grid, Typography, useTheme, TextField, IconButton, CircularProgress } from '@mui/material';
import { ethers } from 'ethers';
import { StakingPoolABI } from '../../utils/StakingPoolABI';
import { toast } from 'react-toastify';
import { getTokenInfo, toString } from '../../utils/Helper';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const Withdraw = () => {
  const navigate = useNavigate();
  const [searchParam,] = useSearchParams();
  const theme = useTheme();
  const { active, account, library } = useWeb3React();
  const [stakingPoolAddress, setStakingPoolAddress] = useState('');
  const [stakedToken, setStakedToken] = useState({});
  const [stakedAmount, setStakedAmount] = useState(0);
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

  const getStakedAmount = useCallback(async () => {
    if (stakingPoolAddress === '') return;
    try {
      const stakingPool = new ethers.Contract(stakingPoolAddress, StakingPoolABI, library.getSigner());
      const userInfo = await stakingPool.userInfo(account);
      setStakedAmount(ethers.utils.formatUnits(userInfo.amount, stakedToken.decimals));
    } catch (error) {
      toast.error('Cannot get staked token amount!');
      console.error(error);
    }
  }, [account, library, stakedToken, stakingPoolAddress])

  const handleChange = e => {
    let tmpVal = e.target.value ? e.target.value : 0;
    if (tmpVal < 0 || isNaN(tmpVal)) {
      return;
    } else if (!(typeof tmpVal === 'string' && (tmpVal.endsWith(".") || tmpVal.startsWith(".")))) {
      tmpVal = Number(e.target.value.toString());
    }
    setAmount(tmpVal);
  }

  const handleWithdraw = async () => {
    if (stakingPoolAddress === '') {
      toast.error("Staking pool not found!");
      return;
    }
    setLoading(true);
    try {
      const stakingPool = new ethers.Contract(stakingPoolAddress, StakingPoolABI, library.getSigner());
      const tx = await stakingPool.withdraw(ethers.utils.parseUnits(toString(amount), stakedToken.decimals));
      await tx.wait();
      toast.info(`Withdraw token successfully! Transaction hash: ${tx.hash}`);
      setAmount(0);
      await getStakedAmount();
    } catch (error) {
      toast.error("Cannot withdraw staked token!");
      console.error(error);
    }
    setLoading(false);
  }

  useEffect(() => {
    const poolAddress = searchParam.get('pool');
    if (active && poolAddress) {
      getStakedToken(poolAddress);
      getStakedAmount();
    }
  }, [active, getStakedAmount, getStakedToken, searchParam]);

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
          <Typography sx={{ mt: 1 }}>Withdraw Staked Token ({stakedToken.symbol})</Typography>
        </Grid>
      </Grid>
      <Divider sx={theme.component.divider} />
      <Grid container spacing={2}>
        <Grid item xs={4}>
          <Typography sx={{ mt: 2 }}>Amount to Withdraw</Typography>
        </Grid>
        <Grid item xs={8}>
          <TextField label={`Please enter the amount of ${stakedToken.symbol} to withdraw`} value={amount}
            onChange={handleChange} fullWidth />
          <Typography sx={theme.component.hintText}>Staked {stakedToken.symbol}: {stakedAmount}</Typography>
          <Button sx={{ fontSize: 12, padding: '0px' }} onClick={() => setAmount(stakedAmount)} >Max</Button>
        </Grid>
        <Grid item xs={4} />
        <Grid item xs={4}>
          <Button disabled={amount <= 0 || amount > stakedAmount} sx={theme.component.primaryButton} fullWidth onClick={() => handleWithdraw()}>
            {loading ? <CircularProgress sx={{ color: 'white' }} /> : (amount > stakedAmount ? "Withdraw too much!" : "Withdraw")}
          </Button>
        </Grid>
        <Grid item xs={4} />
      </Grid>
    </Grid>
  </Grid >;
}

export default Withdraw;