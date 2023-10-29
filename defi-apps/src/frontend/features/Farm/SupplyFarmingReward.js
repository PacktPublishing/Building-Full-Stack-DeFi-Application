import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useWeb3React } from "@web3-react/core";
import { Button, Divider, Grid, Typography, useTheme, TextField, IconButton, CircularProgress } from '@mui/material';
import { ethers } from 'ethers';
import { StakingPoolABI } from '../../utils/StakingPoolABI';
import { ERC20ABI } from '../../utils/ERC20ABI';
import { toast } from 'react-toastify';
import { getTokenInfo, toString } from '../../utils/Helper';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const SupplyFarmingReward = () => {
  const navigate = useNavigate();
  const [searchParam,] = useSearchParams();
  const theme = useTheme();
  const { active, account, library } = useWeb3React();
  const [rewardToken, setRewardToken] = useState({});
  const [farmingPoolAddress, setFarmingPoolAddress] = useState('');
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  const getRewardToken = useCallback(async (poolAddress) => {
    try {
      const farmingPool = new ethers.Contract(poolAddress, StakingPoolABI, library.getSigner());
      const _rewardToken = await getTokenInfo(await farmingPool.rewardToken());
      setRewardToken(_rewardToken);
      setFarmingPoolAddress(poolAddress);
    } catch (error) {
      toast.error(`Cannot get the information of reward token with farming pool address ${poolAddress}!`);
      console.error(error);
    }
  }, [library]);

  const getBalance = useCallback(async () => {
    if (farmingPoolAddress === '') return;
    try {
      const tokenContract = new ethers.Contract(rewardToken.address, ERC20ABI, library.getSigner());
      const _balance = await tokenContract.balanceOf(account);
      setBalance(Number(ethers.utils.formatUnits(_balance, rewardToken.decimals)));
    } catch (error) {
      toast.error('Cannot get balance for reward token!');
      console.error(error);
    }
  }, [account, library, rewardToken, farmingPoolAddress]);

  const handleChange = e => {
    let tmpVal = e.target.value ? e.target.value : 0;
    if (tmpVal < 0 || isNaN(tmpVal)) {
      return;
    } else if (!(typeof tmpVal === 'string' && (tmpVal.endsWith(".") || tmpVal.startsWith(".")))) {
      tmpVal = Number(e.target.value.toString());
    }
    setAmount(tmpVal);
  }

  const handleSupply = async () => {
    setLoading(true);
    try {
      const tokenContract = new ethers.Contract(rewardToken.address, ERC20ABI, library.getSigner());
      const tx = await tokenContract.transfer(farmingPoolAddress, ethers.utils.parseUnits(toString(amount), rewardToken.decimals));
      await tx.wait();
      toast.info(`Successfully transferred reward token to farming pool! Transaction Hash: ${tx.hash}`);
      setAmount(0);
      await getBalance();
    } catch (error) {
      toast.error("Cannot supply token to farming pool");
      console.error(error);
    }
    setLoading(false);
  }

  useEffect(() => {
    const poolAddress = searchParam.get('pool');
    if (active && poolAddress) {
      getRewardToken(poolAddress);
      getBalance();
    }
  }, [active, searchParam, getBalance, getRewardToken]);

  if (!active) {
    return <Typography>Please connect to a wallet to supply reward</Typography>;
  } else if (Object.keys(rewardToken).length === 0) {
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
          <Typography sx={{ mt: 1 }}>Supply Reward Token ({rewardToken.symbol})</Typography>
        </Grid>
      </Grid>
      <Divider sx={theme.component.divider} />
      <Grid container spacing={2}>
        <Grid item xs={4}>
          <Typography sx={{ mt: 2 }}>Amount to Supply</Typography>
        </Grid>
        <Grid item xs={8}>
          <TextField label={`Please enter reward token (${rewardToken.symbol}) amount`} value={amount}
            onChange={handleChange} fullWidth />
          <Typography sx={theme.component.hintText}>Balance of {rewardToken.symbol}: {balance}</Typography>
        </Grid>
        <Grid item xs={4}></Grid>
        <Grid item xs={4}>
          <Button disabled={amount <= 0} sx={theme.component.primaryButton} fullWidth onClick={() => handleSupply()}>
            {loading ? <CircularProgress sx={{ color: 'white' }} /> : "Supply"}
          </Button>
        </Grid>
        <Grid item xs={4}></Grid>
      </Grid>
    </Grid>
  </Grid>
}
export default SupplyFarmingReward;