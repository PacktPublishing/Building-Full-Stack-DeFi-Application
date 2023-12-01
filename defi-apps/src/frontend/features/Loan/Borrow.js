import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useWeb3React } from "@web3-react/core";
import { Button, Divider, Grid, Typography, useTheme, TextField, IconButton, CircularProgress } from '@mui/material';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { getTokenInfo, toString } from '../../utils/Helper';
import AssetPoolABI from '../../contracts/AssetPool.json';
import AssetPoolAddress from '../../contracts/AssetPool-address.json';

const Borrow = () => {
  const navigate = useNavigate();
  const [searchParam,] = useSearchParams();
  const theme = useTheme();
  const { active, account, library } = useWeb3React();
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState({});
  const [borrowableQuota, setBorrowableQuota] = useState(0);
  const [amount, setAmount] = useState(0);

  const getBorrowableQuota = useCallback(async tokenObject => {
    try {
      const assetPool = new ethers.Contract(AssetPoolAddress.address, AssetPoolABI.abi, library.getSigner());
      const userInfo = await assetPool.getUserInfo(account);
      const tokenPrice = await assetPool.getPriceInWETH(tokenObject.address);
      const poolInfo = await assetPool.getPool(tokenObject.address);
      let _quota = Number(userInfo.totalCollateralValue.sub(userInfo.totalBorrowedValue).div(tokenPrice));
      let _available = Number(ethers.utils.formatUnits(poolInfo.availableLiquidity, tokenObject.decimals));
      setBorrowableQuota(Math.min(_available, _quota));
    } catch (error) {
      toast.error("Cannot get quota for current user!");
      console.log(error);
    }
  }, [account, library]);

  const loadBorrowInfo = useCallback(async tokenAddress => {
    setLoading(true);
    try {
      const tokenObject = await getTokenInfo(tokenAddress);
      setToken(tokenObject);
      await getBorrowableQuota(tokenObject);
    } catch (error) {
      toast.error("Failed to load information for borrowing!");
      console.log(error);
    }
    setLoading(false);
  }, [getBorrowableQuota]);

  useEffect(() => {
    const tokenAddress = searchParam.get('token');
    if (active && tokenAddress) {
      loadBorrowInfo(tokenAddress);
    }
  }, [active, loadBorrowInfo, searchParam]);

  const handleChange = e => {
    let tmpVal = e.target.value ? e.target.value : 0;
    if (tmpVal < 0 || isNaN(tmpVal)) {
      return;
    } else if (!(typeof tmpVal === 'string' && (tmpVal.endsWith(".") || tmpVal.startsWith(".")))) {
      tmpVal = Number(e.target.value.toString());
    }
    setAmount(tmpVal);
  }

  const handleBorrow = async () => {
    setLoading(true);
    try {
      const assetPool = new ethers.Contract(AssetPoolAddress.address, AssetPoolABI.abi, library.getSigner());
      const tx = await assetPool.borrow(token.address, ethers.utils.parseUnits(toString(amount), token.decimals));
      await tx.wait();
      toast.info(`Token borrowed successfully! Transaction hash: ${tx.hash}`);
      setAmount(0);
      await getBorrowableQuota(token);
    } catch (error) {
      toast.error("Cannot borrow token!");
      console.error(error);
    }
    setLoading(false);
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
          <Typography sx={{ mt: 1 }}>Borrow Assets</Typography>
        </Grid>
      </Grid>
      <Divider sx={theme.component.divider} />
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Typography sx={{ mt: 2 }}>Amount to Borrow</Typography>
        </Grid>
        <Grid item xs={6}>
          <TextField label={`Please enter amount of ${token.symbol}`} value={amount} onChange={handleChange} fullWidth />
          <Typography sx={theme.component.hintText}>Borrowable Quota of {token.symbol}: {borrowableQuota}</Typography>
          <Button sx={{ fontSize: 12, padding: '0px' }} onClick={() => setAmount(borrowableQuota)} >Max</Button>
        </Grid>
        <Grid item xs={3} />
        <Grid item xs={6}>
          <Button disabled={amount <= 0 || amount > borrowableQuota} sx={theme.component.primaryButton} fullWidth
            onClick={handleBorrow}>{loading ? <CircularProgress sx={{ color: 'white' }} /> : "Borrow"}</Button>
        </Grid>
        <Grid item xs={3} />
      </Grid>
    </Grid>
  </Grid>
};

export default Borrow;