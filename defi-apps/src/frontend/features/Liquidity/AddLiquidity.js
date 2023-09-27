import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useWeb3React } from "@web3-react/core";
import { Button, Divider, Grid, Typography, useTheme, TextField, IconButton, CircularProgress } from '@mui/material';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { toast } from 'react-toastify';
import { TokenPairABI } from '../../utils/TokenPairABI';
import { ethers } from 'ethers';
import { getTokenInfo, getErrorMessage, toString } from '../../utils/Helper';
import { ERC20ABI } from '../../utils/ERC20ABI';
import AMMRouterAddress from '../../contracts/AMMRouter-address.json';
import AMMRouterABI from '../../contracts/AMMRouter.json';
import TokenSelectModal from '../../components/TokenSelectModal';

const AddLiquidity = () => {
  const [searchParam,] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { active, account, library } = useWeb3React();
  const [amountA, setAmountA] = useState(0);
  const [amountB, setAmountB] = useState(0);
  const [allowA, setAllowA] = useState(false);
  const [allowB, setAllowB] = useState(false);
  const [allowAmountA, setAllowAmountA] = useState(0);
  const [allowAmountB, setAllowAmountB] = useState(0);
  const [balanceA, setBalanceA] = useState(0);
  const [balanceB, setBalanceB] = useState(0);
  const [reserveA, setReserveA] = useState(0);
  const [reserveB, setReserveB] = useState(0);
  const [tokenA, setTokenA] = useState({});
  const [tokenB, setTokenB] = useState({});
  const [pair, setPair] = useState('');
  const [availableBalance, setAvailableBalance] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [tokenIndex, setTokenIndex] = useState(0); // 0 = tokenA, 1 = tokenB
  const [tokensSelected, setTokenSelected] = useState(false);
  const [indexTokenA, indexTokenB] = [0, 1];

  // Set token information and reserves using pair address (tokens are unknown)
  const setTokenInfo = useCallback(async (pairAddress) => {
    if (tokensSelected) {
      return;
    }
    try {
      const tokenPair = new ethers.Contract(pairAddress, TokenPairABI, library.getSigner());
      const _tokenA = await getTokenInfo(await tokenPair.tokenA());
      const _tokenB = await getTokenInfo(await tokenPair.tokenB());
      setTokenA(_tokenA);
      setTokenB(_tokenB);
      setTokenSelected(true);
    } catch (error) {
      toast.error(getErrorMessage(error, "Cannot fetch token information for the pair!"), { toastId: 'PAIR_0' })
      console.error(error);
    }
  }, [library, tokensSelected]);

  // Set reserves using token addresses(tokens information are known)
  const getReserves = useCallback(async () => {
    if (!tokensSelected) {
      return;
    }
    try {
      const ammRouter = new ethers.Contract(AMMRouterAddress.address, AMMRouterABI.abi, library.getSigner());
      const [_reserveA, _reserveB, _pairAddress] = await ammRouter.getReserves(tokenA.address, tokenB.address);
      setPair(_pairAddress);
      setReserveA(ethers.utils.formatUnits(_reserveA, tokenA.decimals));
      setReserveB(ethers.utils.formatUnits(_reserveB, tokenB.decimals));
    } catch (error) {
      toast.info("Looks you are the first one to provide liquidity for the pair.", { toastId: 'RESERVE_0' })
      setPair('');
      console.log(error);
    }
  }, [library, tokenA, tokenB, tokensSelected]);

  const getBalances = useCallback(async () => {
    if (!tokensSelected) {
      return;
    }
    try {
      const _tokenA = new ethers.Contract(tokenA.address, ERC20ABI, library.getSigner());
      const _balanceA = await _tokenA.balanceOf(account);
      setBalanceA(Number(ethers.utils.formatUnits(_balanceA, tokenA.decimals)));
      const _tokenB = new ethers.Contract(tokenB.address, ERC20ABI, library.getSigner());
      const _balanceB = await _tokenB.balanceOf(account);
      setBalanceB(Number(ethers.utils.formatUnits(_balanceB, tokenB.decimals)));
    } catch (error) {
      toast.error(getErrorMessage(error, "Cannot get token balances!"), { toastId: 'BALANCE_0' });
      console.error(error);
    }
  }, [account, library, tokenA, tokenB, tokensSelected]);

  const checkAllowances = useCallback(async () => {
    if (!tokensSelected) {
      return;
    }
    try {
      const _tokenA = new ethers.Contract(tokenA.address, ERC20ABI, library.getSigner());
      let _allowA = await _tokenA.allowance(account, AMMRouterAddress.address);
      _allowA = Number(ethers.utils.formatUnits(_allowA, tokenA.decimals));
      setAllowAmountA(_allowA);
      setAllowA(_allowA >= amountA);
      const _tokenB = new ethers.Contract(tokenB.address, ERC20ABI, library.getSigner());
      let _allowB = await _tokenB.allowance(account, AMMRouterAddress.address);
      _allowB = Number(ethers.utils.formatUnits(_allowB, tokenB.decimals));
      setAllowAmountB(_allowB);
      setAllowB(_allowB >= amountB);
    } catch (error) {
      toast.error(getErrorMessage(error, "Cannot check allowances!"));
      console.error(error);
    }
  }, [account, library, tokenA, tokenB, amountA, amountB, tokensSelected]);

  useEffect(() => {
    const pairAddress = searchParam.get('pair');
    if (active && pairAddress) {
      setTokenInfo(pairAddress);
      getReserves();
      getBalances();
      checkAllowances();
    } else if (tokensSelected) {
      getReserves();
      getBalances();
      checkAllowances();
    }
  }, [active, searchParam, tokensSelected, checkAllowances, getBalances, getReserves, setTokenInfo]);

  const handleChange = e => {
    let tmpVal = e.target.value ? e.target.value : 0;
    let id = e.target.id;
    if (tmpVal < 0 || isNaN(tmpVal)) {
      tmpVal = id === 'tokenA' ? amountA : amountB;
    } else if (!(typeof tmpVal === 'string' && (tmpVal.endsWith(".") || tmpVal.startsWith(".")))) {
      tmpVal = Number(e.target.value.toString());
    }
    if (id === 'tokenA') {
      setAmountA(toString(tmpVal));
      let _amountB = amountB;
      if (pair) {
        _amountB = (tmpVal * reserveB / reserveA).toFixed(2);
        setAmountB(toString(_amountB));
      }
      setAvailableBalance(tmpVal <= balanceA && _amountB <= balanceB);
      setAllowA(allowAmountA >= tmpVal);
      setAllowB(allowAmountB >= _amountB);
    } else {
      setAmountB(toString(tmpVal));
      let _amountA = amountA;
      if (pair) {
        _amountA = (tmpVal * reserveA / reserveB).toFixed(2);
        setAmountA(toString(_amountA));
      }
      setAvailableBalance(_amountA <= balanceA && tmpVal <= balanceB);
      setAllowA(allowAmountA >= _amountA);
      setAllowB(allowAmountB >= tmpVal);
    }
  }

  const handleApprove = async (index) => {
    setLoading(true);
    const [token, amount] = index === indexTokenA ? [tokenA, amountA] : [tokenB, amountB];
    try {
      const tokenContract = new ethers.Contract(token.address, ERC20ABI, library.getSigner());
      const allowAmount = ethers.utils.parseUnits(toString(amount), token.decimals);
      const tx = await tokenContract.approve(AMMRouterAddress.address, allowAmount);
      await tx.wait();
      toast.info(`${token.symbol} is enabled!`);
      if (index === indexTokenA) {
        setAllowA(true);
      } else {
        setAllowB(true);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, `Cannot enable ${token.symbol} !`));
      console.error(error);
    }
    setLoading(false);
  }

  const handleAddLiquidity = async () => {
    setLoading(true);
    try {
      const ammRouter = new ethers.Contract(AMMRouterAddress.address, AMMRouterABI.abi, library.getSigner());
      const tx = await ammRouter.addLiquidity(tokenA.address, tokenB.address,
        ethers.utils.parseUnits(toString(amountA), tokenA.decimals),
        ethers.utils.parseUnits(toString(amountB), tokenB.decimals),
        0, 0, account, parseInt(new Date().getTime() / 1000) + 30);
      await tx.wait();
      toast.info(`Liquidity provisioning succeeded! Transaction Hash: ${tx.hash}`);
      setAmountA(0);
      setAmountB(0);
      await getBalances();
      await getReserves();
    } catch (error) {
      toast.error(getErrorMessage(error, "Cannot add liquidity!"));
      console.error(error);
    }
    setLoading(false);
  }

  const handleSelectToken = (token) => {
    if (tokenIndex === indexTokenA && token.address !== tokenB.address) {
      setTokenA(token);
      setAmountA(0);
      setTokenSelected(Object.keys(tokenB).length > 0);
    } else if (tokenIndex === indexTokenB && token.address !== tokenA.address) {
      setTokenB(token);
      setAmountB(0);
      setTokenSelected(Object.keys(tokenA).length > 0);
    } else {
      toast.error("Please select a different token!");
    }
  }

  const getPrice = (index) => {
    const [reserve0, reserve1] = index === 0 ? [reserveA, reserveB] : [reserveB, reserveA];
    const [amount0, amount1] = index === 0 ? [amountA, amountB] : [amountB, amountA];
    const ret = pair ? reserve1 / reserve0 : amount1 / amount0;
    return isNaN(ret) ? "N/A" : ret.toFixed(4);
  }

  const getSharePercent = () => {
    let sharePercent = 100 * Number(amountA) / (Number(amountA) + Number(reserveA));
    return isNaN(sharePercent) || sharePercent < 0.01 ? "< 0.01" : sharePercent.toFixed(2)
  }

  return (active ? <Grid container>
    <Grid item >
      <Grid container columnGap={12}>
        <Grid item>
          <IconButton onClick={() => { navigate('..', { replace: true }) }}>
            <ArrowBackIcon />
          </IconButton>
        </Grid>
        <Grid item>
          <Typography>Add Liquidity</Typography>
          <Typography sx={theme.component.hintText}>You need to supply a pair of tokens.</Typography>
        </Grid>
      </Grid>
      <Divider sx={theme.component.divider} />
      <Grid container spacing="8">
        <Grid item>
          <Typography sx={theme.component.hintText}>Input</Typography>
          <Button
            sx={theme.component.selectButton}
            endIcon={<KeyboardArrowDownIcon />}
            onClick={() => { setOpenModal(true); setTokenIndex(0); }}
          >
            {Object.keys(tokenA).length === 0 ? "Select a token" : tokenA.symbol}
          </Button>
        </Grid>
        <Grid item>
          <TextField id="tokenA" label="The amount to supply" value={amountA}
            sx={{ minWidth: 320 }} onChange={handleChange} />
          <Typography sx={theme.component.hintText}>Balance: {balanceA}</Typography>
        </Grid>
      </Grid>
      <Divider sx={theme.component.divider} >+</Divider>
      <Grid container spacing="8">
        <Grid item>
          <Typography sx={theme.component.hintText}>Input</Typography>
          <Button
            sx={theme.component.selectButton}
            endIcon={<KeyboardArrowDownIcon />}
            onClick={() => { setOpenModal(true); setTokenIndex(1); }}
          >
            {Object.keys(tokenB).length === 0 ? "Select a token" : tokenB.symbol}
          </Button>
        </Grid>
        <Grid item>
          <TextField id="tokenB" label="The amount to supply" value={amountB}
            sx={{ minWidth: 320 }} onChange={handleChange} />
          <Typography sx={theme.component.hintText}>Balance: {balanceB}</Typography>
        </Grid>
      </Grid>
      <Divider sx={theme.component.divider} >Prices and Shares</Divider>
      {tokensSelected ? <Grid container columnSpacing={2}>
        <Grid item md={4}>
          <Grid container direction="column" alignItems="center" >
            <Grid item><Typography>{getPrice(indexTokenB)}</Typography></Grid>
            <Grid item><Typography>{tokenA.symbol} per {tokenB.symbol}</Typography></Grid>
          </Grid>
        </Grid>
        <Grid item md={4}>
          <Grid container direction="column" alignItems="center" >
            <Grid item><Typography>{getPrice(indexTokenA)}</Typography></Grid>
            <Grid item><Typography>{tokenB.symbol} per {tokenA.symbol}</Typography></Grid>
          </Grid>
        </Grid>
        <Grid item md={4}>
          <Grid container direction="column" alignItems="center" >
            <Grid item><Typography>{getSharePercent()} %</Typography></Grid>
            <Grid item><Typography>Share of Pool</Typography></Grid>
          </Grid>
        </Grid>
      </Grid> : <Typography>No information! Please select a pair of tokens.</Typography>}
      {tokensSelected && <Grid container sx={{ mt: 2 }} spacing={1}>
        {!allowA && <Grid item xs={12}>
          <Button sx={theme.component.primaryButton} fullWidth
            onClick={() => handleApprove(indexTokenA)}>
            Enable {tokenA.symbol}
          </Button>
        </Grid>}
        {!allowB && <Grid item xs={12}>
          <Button sx={theme.component.primaryButton} fullWidth
            onClick={() => handleApprove(indexTokenB)}>
            Enable {tokenB.symbol}
          </Button>
        </Grid>}
        <Grid item xs={12}>
          <Button sx={theme.component.primaryButton} fullWidth
            disabled={!allowA || !allowB || !availableBalance || amountA <= 0 || amountB <= 0}
            onClick={handleAddLiquidity}
          >
            {availableBalance ? (loading ? <CircularProgress sx={{ color: 'white' }} /> : "Supply") : "Insufficent Balance"}
          </Button>
        </Grid>
      </Grid>}
      <TokenSelectModal open={openModal}
        handleClose={() => setOpenModal(false)}
        selectToken={handleSelectToken}
      />
    </Grid>
  </Grid > : <Typography>Please connect to a wallet to add liquidity</Typography>);
}

export default AddLiquidity;