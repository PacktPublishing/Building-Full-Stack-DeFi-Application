import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useWeb3React } from "@web3-react/core";
import { Button, Divider, Grid, Typography, useTheme, TextField, IconButton, CircularProgress } from '@mui/material';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { getTokenInfo, toString } from '../../utils/Helper';
import { ERC20ABI } from '../../utils/ERC20ABI';
import AssetPoolABI from '../../contracts/AssetPool.json';
import AssetPoolAddress from '../../contracts/AssetPool-address.json';

const Withdraw = () => {
  const navigate = useNavigate();
  const [searchParam,] = useSearchParams();
  const theme = useTheme();
  const { active, account, library } = useWeb3React();
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState({});
  const [depositBalance, setDepositBalance] = useState(0);
  const [amount, setAmount] = useState(0);

  const getWithdrawableBalance = useCallback(async tokenObject => {
    try {
      const assetPool = new ethers.Contract(AssetPoolAddress.address, AssetPoolABI.abi, library.getSigner());
      let _balance = await assetPool.getUserCompoundedLiquidityBalance(account, tokenObject.address);
      _balance = Number(ethers.utils.formatUnits(_balance, tokenObject.decimals));
      const poolInfo = await assetPool.getPool(tokenObject.address);
      let _available = Number(ethers.utils.formatUnits(poolInfo.availableLiquidity, tokenObject.decimals));
      setDepositBalance(Math.min(_available, _balance));
    } catch (error) {
      toast.error("Cannot get deposit balance!");
      console.error(error);
    }
  }, [account, library]);

  const loadWithdrawInfo = useCallback(async tokenAddress => {
    setLoading(true);
    try {
      const tokenObject = await getTokenInfo(tokenAddress);
      setToken(tokenObject);
      await getWithdrawableBalance(tokenObject);
    } catch (error) {
      toast.error("Failed to load information for withdrawal!");
      console.log(error);
    }
    setLoading(false);
  }, [getWithdrawableBalance]);

  const handleChange = e => {
    let tmpVal = e.target.value ? e.target.value : 0;
    if (tmpVal < 0 || isNaN(tmpVal)) {
      return;
    } else if (!(typeof tmpVal === 'string' && (tmpVal.endsWith(".") || tmpVal.startsWith(".")))) {
      tmpVal = Number(e.target.value.toString());
    }
    setAmount(tmpVal);
  };

  const getShareBalance = async (assetPool, tokenAddress) => {
    try {
      const pool = await assetPool.pools(tokenAddress);
      const shareContract = new ethers.Contract(pool.shareToken, ERC20ABI, library.getSigner());
      return await shareContract.balanceOf(account);
    } catch (error) {
      toast.error("Cannot get the balance of share tokens");
      console.log(error);
    }
    return 0;
  };

  const handleWithdraw = async () => {
    try {
      const assetPool = new ethers.Contract(AssetPoolAddress.address, AssetPoolABI.abi, library.getSigner());
      let tx;
      if (depositBalance <= amount) {
        // Withdraw all shares
        const shareBalance = await getShareBalance(assetPool, token.address);
        tx = await assetPool.withdrawByShare(token.address, shareBalance);
      } else {
        tx = await assetPool.withdrawByAmount(token.address, ethers.utils.parseUnits(toString(amount), token.decimals));
      }
      await tx.wait();
      toast.info(`Withdraw token successfully! Transaction hash: ${tx.hash}`);
      setAmount(0);
      await getWithdrawableBalance(token);
    } catch (error) {
      toast.error("Failed to withdraw!");
      console.error(error);
    }
  };

  useEffect(() => {
    const tokenAddress = searchParam.get('token');
    if (active && tokenAddress) {
      loadWithdrawInfo(tokenAddress);
    }
  }, [active, searchParam, loadWithdrawInfo]);

  return <Grid container>
    <Grid item>
      <Grid container columnGap={12}>
        <Grid item>
          <IconButton onClick={() => { navigate('..', { replace: true }) }}>
            <ArrowBackIcon />
          </IconButton>
        </Grid>
        <Grid item>
          <Typography sx={{ mt: 1 }}>Withdraw Asset</Typography>
        </Grid>
      </Grid>
      <Divider sx={theme.component.divider} />
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Typography sx={{ mt: 2 }}>Amount to withdraw</Typography>
        </Grid>
        <Grid item xs={6}>
          <TextField label={`Please enter amount of ${token.symbol}`} value={amount} onChange={handleChange} fullWidth />
          <Typography sx={theme.component.hintText}>Withdrawable balance of {token.symbol}: {depositBalance}</Typography>
          <Button sx={{ fontSize: 12, padding: '0px' }} onClick={() => setAmount(depositBalance)} >Max</Button>
        </Grid>
        <Grid item xs={3} />
        <Grid item xs={6}>
          <Button disabled={amount <= 0 || amount > depositBalance} sx={theme.component.primaryButton} fullWidth
            onClick={handleWithdraw}>
            {loading ? <CircularProgress sx={{ color: 'white' }} /> : "Withdraw"}
          </Button>
        </Grid>
        <Grid item xs={3} />
      </Grid>
    </Grid>
  </Grid>;
};

export default Withdraw;