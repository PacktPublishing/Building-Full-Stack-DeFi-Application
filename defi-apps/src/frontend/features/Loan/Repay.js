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


const Repay = () => {
  const navigate = useNavigate();
  const [searchParam,] = useSearchParams();
  const theme = useTheme();
  const { active, account, library } = useWeb3React();
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState({});
  const [payoffAmount, setPayoffAmount] = useState(0);
  const [maxRepayAmount, setMaxRepayAmount] = useState(0);
  const [amount, setAmount] = useState(0);
  const [allow, setAllow] = useState(0);

  const getMaxRepayAmount = useCallback(async tokenObject => {
    try {
      const tokenContract = new ethers.Contract(tokenObject.address, ERC20ABI, library.getSigner());
      let _balance = await tokenContract.balanceOf(account);
      _balance = Number(ethers.utils.formatUnits(_balance, tokenObject.decimals));
      const assetPool = new ethers.Contract(AssetPoolAddress.address, AssetPoolABI.abi, library.getSigner());
      const userPoolData = await assetPool.getUserPoolData(account, tokenObject.address);
      const _compoundBorrow = Number(ethers.utils.formatUnits(userPoolData.compoundedBorrowBalance));
      setPayoffAmount(_compoundBorrow);
      setMaxRepayAmount(Math.min(_compoundBorrow, _balance));
    } catch (error) {
      toast.error("Cannot get maximum repay amount!");
      console.log(error);
    }
  }, [account, library]);

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

  const loadRepayInfo = useCallback(async tokenAddress => {
    setLoading(true);
    try {
      const tokenObject = await getTokenInfo(tokenAddress);
      setToken(tokenObject);
      await getMaxRepayAmount(tokenObject);
      await checkAllowance(tokenObject);
    } catch (error) {
      toast.error("Failed to load information for repay!");
      console.log(error);
    }
    setLoading(false);
  }, [checkAllowance, getMaxRepayAmount])

  useEffect(() => {
    const tokenAddress = searchParam.get('token');
    if (active && tokenAddress) {
      loadRepayInfo(tokenAddress);
    }
  }, [active, searchParam, loadRepayInfo]);

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
      const allowAmount = ethers.utils.parseUnits(toString(amount * 1.1), token.decimals);
      const tx = await tokenContract.approve(AssetPoolAddress.address, allowAmount);
      await tx.wait()
      toast.info("Deposit amount is approved!");
      await checkAllowance(token);
    } catch (error) {
      toast.error("Cannot approve the repayment amount!");
      console.error(error);
    }
    setLoading(false);
  }

  const getBorrowedShareBalance = async (assetPool, tokenAddress) => {
    try {
      const userPoolData = await assetPool.userPoolData(account, tokenAddress);
      return userPoolData.borrowShares;
    } catch (error) {
      toast.error("Cannot get the balance of borrowed shares!");
      console.log(error);
    }
    return 0;
  };

  const handleRepay = async () => {
    setLoading(true);
    try {
      const assetPool = new ethers.Contract(AssetPoolAddress.address, AssetPoolABI.abi, library.getSigner());
      let tx;
      if (payoffAmount <= amount) {
        // Pay off the loan
        const borrowedSharesAmount = await getBorrowedShareBalance(assetPool, token.address);
        tx = await assetPool.repayByShare(token.address, borrowedSharesAmount);
      } else {
        tx = await assetPool.repayByAmount(token.address, ethers.utils.parseUnits(toString(amount), token.decimals));
      }
      await tx.wait();
      toast.info(`Repay token successfully! Transaction hash: ${tx.hash}`);
      setAmount(0);
      await getMaxRepayAmount(token);
      await checkAllowance(token);
    } catch (error) {
      toast.error("Cannot repay token!")
      console.log(error);
    }
    setLoading(false);
  }

  if (!active) {
    return <Typography>Please connect to a wallet to repay</Typography>;
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
          <Typography sx={{ mt: 1 }}>Repay the loan</Typography>
        </Grid>
      </Grid>
      <Divider sx={theme.component.divider} />
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Typography sx={{ mt: 2 }}>Amount to Deposit</Typography>
        </Grid>
        <Grid item xs={6}>
          <TextField label={`Please enter amount of ${token.symbol}`} value={amount} onChange={handleChange} fullWidth />
          <Typography sx={theme.component.hintText}>Maximum Repayment Amount {token.symbol}: {maxRepayAmount}</Typography>
          <Button sx={{ fontSize: 12, padding: '0px' }} onClick={() => setAmount(maxRepayAmount)} >Max</Button>
        </Grid>
        <Grid item xs={6}>
          <Button disabled={amount <= 0 || allow >= amount * 1.1} sx={theme.component.primaryButton} fullWidth onClick={handleApprove}>
            {allow < amount && loading ? <CircularProgress sx={{ color: 'white' }} /> : "Approve"}
          </Button>
        </Grid>
        <Grid item xs={6}>
          <Button disabled={amount <= 0 || allow < amount || amount > maxRepayAmount} sx={theme.component.primaryButton} fullWidth
            onClick={handleRepay}>
            {allow >= amount && loading ? <CircularProgress sx={{ color: 'white' }} /> : "Repay"}
          </Button>
        </Grid>
      </Grid>
    </Grid>
  </Grid>
};

export default Repay;