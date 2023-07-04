import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useWeb3React } from "@web3-react/core";
import { Button, Divider, Grid, Typography, useTheme, Box, Slider, TextField, IconButton, CircularProgress } from '@mui/material';
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { toast } from 'react-toastify';
import { TokenPairABI } from '../../utils/TokenPairABI';
import AMMRouterAddress from '../../contracts/AMMRouter-address.json';
import AMMRouterABI from '../../contracts/AMMRouter.json';
import { ethers } from 'ethers';
import { getErrorMessage, getTokenInfo, toString } from '../../utils/Helper';

const RemoveLiquidity = () => {
  const [searchParam,] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { active, account, library } = useWeb3React();
  const [tokenA, setTokenA] = useState({});
  const [tokenB, setTokenB] = useState({});
  const [reserveA, setReserveA] = useState(0);
  const [reserveB, setReserveB] = useState(0);
  const [pair, setPair] = useState();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState(0);
  const [totalSupply, setTotalSupply] = useState(0);
  const [loading, setLoading] = useState(false);
  const [allowAmount, setAllowAmount] = useState(0);

  // Set token information and reserves using pair address (tokens are unknown)
  const setTokenInfo = useCallback(async (pairAddress) => {
    try {
      const tokenPair = new ethers.Contract(pairAddress, TokenPairABI, library.getSigner());
      const _tokenA = await getTokenInfo(await tokenPair.tokenA());
      const _tokenB = await getTokenInfo(await tokenPair.tokenB());
      setTokenA(_tokenA);
      setTokenB(_tokenB);
      setPair(pairAddress);
    } catch (error) {
      toast.error(getErrorMessage(error, "Cannot fetch token information for the pair!"), { toastId: 'PAIR_0' })
      console.error(error);
    }
  }, [library]);

  const getBalance = useCallback(async () => {
    try {
      const tokenPair = new ethers.Contract(pair, TokenPairABI, library.getSigner());
      const _balance = await tokenPair.balanceOf(account);
      setBalance(ethers.utils.formatUnits(_balance));
    } catch (error) {
      toast.error(getErrorMessage(error, "Cannot get LP token balance!"));
      console.error(error);
    }
  }, [account, library, pair]);

  const getReserves = useCallback(async () => {
    try {
      const tokenPair = new ethers.Contract(pair, TokenPairABI, library.getSigner())
      const [_reserveA, _reserveB,] = await tokenPair.getReserves();
      setReserveA(ethers.utils.formatUnits(_reserveA, tokenA.decimals));
      setReserveB(ethers.utils.formatUnits(_reserveB, tokenB.decimals));
    } catch (error) {
      toast.error(getErrorMessage(error, "Cannot get reserves!"));
      console.error(error);
    }
  }, [library, pair, tokenA, tokenB]);

  const getTotalSupply = useCallback(async () => {
    try {
      const tokenPair = new ethers.Contract(pair, TokenPairABI, library.getSigner())
      const _totalSupply = await tokenPair.totalSupply();
      setTotalSupply(ethers.utils.formatUnits(_totalSupply));
    } catch (error) {
      toast.error(getErrorMessage(error, "Cannot get total supply of token pair!"));
      console.error(error);
    }
  }, [library, pair]);

  const getAllowance = useCallback(async () => {
    try {
      const tokenPair = new ethers.Contract(pair, TokenPairABI, library.getSigner());
      const _allowAmount = await tokenPair.allowance(account, AMMRouterAddress.address);
      setAllowAmount(ethers.utils.formatUnits(_allowAmount));
    } catch (error) {
      toast.error(getErrorMessage(error, "Cannot get allowance of token pair!"));
      console.error(error);
    }
  }, [account, library, pair]);

  useEffect(() => {
    const pairAddress = searchParam.get('pair');
    if (pairAddress && active) {
      if (!pair) {
        setTokenInfo(pairAddress);
      } else {
        getBalance();
        getTotalSupply();
        getReserves();
        getAllowance();
      }
    }
  }, [pair, active, searchParam, setTokenInfo, getBalance, getReserves, getAllowance, getTotalSupply]);

  const handleChange = e => {
    let tmpVal = e.target.value ? e.target.value : 0;
    if (tmpVal < 0 || isNaN(tmpVal) || Number(tmpVal) > balance) {
      return;
    } else if (!(typeof tmpVal === 'string' && (tmpVal.endsWith(".") || tmpVal.startsWith(".")))) {
      tmpVal = toString(Number(e.target.value.toString()));
    }
    setAmount(tmpVal);
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const tokenPair = new ethers.Contract(pair, TokenPairABI, library.getSigner());
      const _allowAmount = ethers.utils.parseUnits(toString(amount));
      const tx = await tokenPair.approve(AMMRouterAddress.address, _allowAmount);
      await tx.wait();
      toast.info("Liquidity removal is enabled!");
      await getAllowance();
    } catch (error) {
      toast.error(getErrorMessage(error, "Cannot enable liquidity removal!"));
      console.log(error);
    }
    setLoading(false);
  }

  const handleRemoveLiquidity = async () => {
    setLoading(true);
    try {
      const ammRouter = new ethers.Contract(AMMRouterAddress.address, AMMRouterABI.abi, library.getSigner());
      const tx = await ammRouter.removeLiquidity(tokenA.address,
        tokenB.address, ethers.utils.parseUnits(toString(amount)), 0, 0, account,
        parseInt(new Date().getTime() / 1000) + 30);
      await tx.wait();
      toast.info(`Liquidity removal succeeded! Transaction Hash: ${tx.hash}`);
      setAmount(0);
      await getBalance();
      await getReserves();
      await getTotalSupply();
    } catch (error) {
      toast.error(getErrorMessage(error, "Cannot remove liquidity!"));
      console.log(error);
    }
    setLoading(false);
  }

  let amountPercent = 100 * amount / balance;
  amountPercent = isNaN(amountPercent) ? 0 : amountPercent;

  return (active ? (pair ? <>
    <Grid container alignItems="center" columnGap={12}>
      <Grid item>
        <IconButton onClick={() => { navigate('..', { replace: true }) }}>
          <ArrowBackIcon />
        </IconButton>
      </Grid>
      <Grid item>
        <Typography>Remove {tokenA.symbol}/{tokenB.symbol} LP Token</Typography>
        <Typography sx={theme.component.hintText}>To receive {tokenA.symbol} and {tokenB.symbol}</Typography>
      </Grid>
    </Grid>
    <Divider sx={theme.component.divider} />
    <Grid container justifyContent="space-between" alignItems="center" columnSpacing={4}>
      <Grid item xs={6}>
        <Typography>Amount</Typography>
        <Typography sx={theme.component.hintText}>LP Tokens to Remove / Total</Typography>
      </Grid>
      <Grid item xs={6}>
        <TextField value={amount} onChange={handleChange} />
        <Typography sx={theme.component.hintText}>Balance: {Number(balance).toFixed(2)}</Typography>
      </Grid>
    </Grid>
    <Box width="100%">
      <Typography>Removal Percentage: {amountPercent.toFixed(2)} %</Typography>
      <Slider value={amountPercent} onChange={(e, value) => setAmount(balance * value / 100)} />
      <Grid container justifyContent="space-between" alignItems="center">
        <Button onClick={() => setAmount(balance * 0.25)}>25%</Button>
        <Button onClick={() => setAmount(balance * 0.5)}>50%</Button>
        <Button onClick={() => setAmount(balance * 0.75)}>75%</Button>
        <Button onClick={() => setAmount(balance)}>100%</Button>
      </Grid>
    </Box>
    <Grid container justifyContent="center">
      <ArrowDownwardIcon />
    </Grid>
    <Typography>You will receive approximately:</Typography>
    <Grid container justifyContent="space-between" alignItems="center">
      <Grid item>
        <Typography>Pooled {tokenA.symbol}</Typography>
      </Grid>
      <Grid item>
        <Typography>{(reserveA * amount / totalSupply).toFixed(2)}</Typography>
      </Grid>
    </Grid>
    <Grid container justifyContent="space-between" alignItems="center">
      <Grid item>
        <Typography>Pooled {tokenB.symbol}</Typography>
      </Grid>
      <Grid item>
        <Typography>{(reserveB * amount / totalSupply).toFixed(2)}</Typography>
      </Grid>
    </Grid>
    <Grid container>
      <Grid item xs={6}>
        <Button disabled={allowAmount >= amount} sx={theme.component.primaryButton} fullWidth onClick={handleApprove}>
          {loading && allowAmount < amount ? <CircularProgress sx={{ color: 'white' }} /> : "Enable"}
        </Button>
      </Grid>
      <Grid item xs={6}>
        <Button disabled={amount <= 0 || allowAmount < amount} sx={theme.component.primaryButton} fullWidth
          onClick={handleRemoveLiquidity}>
          {loading && allowAmount >= amount ? <CircularProgress sx={{ color: 'white' }} /> : "Remove"}
        </Button>
      </Grid>
    </Grid>
  </> : <Typography>No pair specified!</Typography>
  ) : <Typography>Please connect wallet first!</Typography>);
};

export default RemoveLiquidity;