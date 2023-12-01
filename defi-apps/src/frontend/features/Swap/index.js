import { useState, useEffect, useCallback } from 'react';
import { useWeb3React } from "@web3-react/core";
import { Grid, Button, Collapse, Fab, CircularProgress, Typography, TextField, useTheme } from '@mui/material';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import AMMRouterAddress from '../../contracts/AMMRouter-address.json';
import AMMRouterABI from '../../contracts/AMMRouter.json';
import TokenSelectModal from '../../components/TokenSelectModal';
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import { buildGraphFromEdges, findAllPaths } from '../../utils/Graph';
import FactoryABI from '../../contracts/PairFactory.json';
import FactoryAddress from '../../contracts/PairFactory-address.json';
import { localProvider } from '../../components/Wallet';
import { TokenPairABI } from '../../utils/TokenPairABI';
import { getErrorMessage, getTokenInfo, toString, isETH } from '../../utils/Helper';
import { ERC20ABI } from '../../utils/ERC20ABI';
import WETH from '../../contracts/WETH-address.json';
import WETHABI from '../../contracts/WETH.json';

const MODE_SWAP = 0;
const MODE_WRAP = 1;
const MODE_UNWRAP = 2;

const Swap = () => {
  const theme = useTheme();
  const { active, account, library } = useWeb3React();
  const [openModal, setOpenModal] = useState(false);
  const [tokenIndex, setTokenIndex] = useState(0); // 0 = tokenA, 1 = tokenB
  const [tokenA, setTokenA] = useState({});
  const [tokenB, setTokenB] = useState({});
  const [amountA, setAmountA] = useState(0);
  const [amountB, setAmountB] = useState(0);
  const [balanceA, setBalanceA] = useState(0);
  const [balanceB, setBalanceB] = useState(0);
  const [price, setPrice] = useState(0);
  const [priceImpact, setPriceImpact] = useState(0);
  const [allowAmount, setAllowAmount] = useState(0);
  const [paths, setPaths] = useState([]);
  const [bestPath, setBestPath] = useState();
  const [hoverOnSwitch, setHoverOnSwitch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [indexTokenA, indexTokenB] = [0, 1];
  const [graph, setGraph] = useState(false);
  const [tokensSelected, setTokensSelected] = useState(false);
  const [swapMode, setSwapMode] = useState(MODE_SWAP);

  const selectToken = (_tokenA, _tokenB) => {
    if (Object.keys(_tokenA).length > 0 && Object.keys(_tokenB).length > 0) {
      const resetToken = () => {
        setTokensSelected(false);
        tokenIndex === indexTokenA ? setTokenA({}) : setTokenB({});
      }
      if (_tokenA.address === _tokenB.address) {
        if (_tokenA.address === WETH.address && _tokenA.symbol !== _tokenB.symbol) {
          if (isETH(_tokenA)) {
            setSwapMode(MODE_WRAP);
          } else {
            setSwapMode(MODE_UNWRAP);
          }
        } else {
          resetToken();
          toast.error('The selected tokens are identical, please select another token!');
          return;
        }
      } else {
        // Check if there is a path between token A and token B
        const _paths = findAllPaths(_tokenA.address, _tokenB.address, graph);
        if (_paths.length <= 0) {
          resetToken();
          toast.error(`There is no swap path from ${_tokenA.symbol} to ${_tokenB.symbol}!`);
          return;
        }
        setSwapMode(MODE_SWAP);
        setPaths(_paths);
      }
    }
    setTokenA(_tokenA);
    setTokenB(_tokenB);
    setAmountA(0);
    setAmountB(0);
    setPrice(0);
    setAllowAmount(0);
    setBestPath([]);
    setTokensSelected(true);
  }

  const initGraph = useCallback(async () => {
    setLoading(true);
    try {
      let factory = new ethers.Contract(FactoryAddress.address, FactoryABI.abi, localProvider);
      const nPairs = await factory.allPairsLength();
      const edgeList = [];

      // Iterate through all pairs to get the edges of the graph
      for (let i = 0; i < nPairs; i++) {
        let pairAddress = await factory.allPairs(i);
        let tokenPair = new ethers.Contract(pairAddress, TokenPairABI, localProvider);
        let _tokenA = await getTokenInfo(await tokenPair.tokenA());
        let _tokenB = await getTokenInfo(await tokenPair.tokenB());
        edgeList.push([_tokenA, _tokenB]);
      }
      // Make the graph with edge list
      const _graph = buildGraphFromEdges(edgeList);
      setGraph(_graph);
      if (edgeList.length > 0) {
        // Set tokenA and tokenB from the first token pair.
        const [_tokenA, _tokenB] = edgeList[0];
        setTokenA(_tokenA);
        setTokenB(_tokenB);
        setTokensSelected(true);
        const _paths = findAllPaths(_tokenA.address, _tokenB.address, _graph);
        setPaths(_paths);
      }
    } catch (error) {
      toast.error("Cannot initiate data for swapping!")
      console.error(error);
    }
    setLoading(false);
  }, []);

  const checkAllowance = useCallback(async () => {
    if (!tokensSelected || isETH(tokenA)) {
      return;
    }
    try {
      const _token = new ethers.Contract(tokenA.address, ERC20ABI, library.getSigner());
      let _allow = await _token.allowance(account, AMMRouterAddress.address);
      _allow = Number(ethers.utils.formatUnits(_allow, tokenA.decimals));
      setAllowAmount(_allow);
    } catch (error) {
      toast.error(getErrorMessage(error, "Cannot check allowances!"));
      console.error(error);
    }
  }, [account, library, tokenA, tokensSelected]);

  const getBalances = useCallback(async () => {
    if (!tokensSelected) {
      return;
    }
    try {
      if (isETH(tokenA)) {
        const _balanceA = await library.getBalance(account);
        setBalanceA(Number(ethers.utils.formatUnits(_balanceA)));
      } else {
        const _tokenA = new ethers.Contract(tokenA.address, ERC20ABI, library.getSigner());
        const _balanceA = await _tokenA.balanceOf(account);
        setBalanceA(Number(ethers.utils.formatUnits(_balanceA, tokenA.decimals)));
      }
      if (isETH(tokenB)) {
        const _balanceB = await library.getBalance(account);
        setBalanceB(Number(ethers.utils.formatUnits(_balanceB)));
      } else {
        const _tokenB = new ethers.Contract(tokenB.address, ERC20ABI, library.getSigner());
        const _balanceB = await _tokenB.balanceOf(account);
        setBalanceB(Number(ethers.utils.formatUnits(_balanceB, tokenB.decimals)));
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Cannot get token balances!"), { toastId: 'BALANCE_0' });
      console.error(error);
    }
  }, [account, library, tokenA, tokenB, tokensSelected]);

  useEffect(() => {
    if (!graph && swapMode === MODE_SWAP) {
      initGraph();
    }
    if (active) {
      checkAllowance();
      getBalances();
    }
  }, [active, checkAllowance, getBalances, graph, initGraph, swapMode]);

  const handleMax = () => {
    setAmountA(balanceA);
    setTokenIndex(indexTokenA);
    if (swapMode === MODE_SWAP) {
      getReceivingAmount(balanceA);
    } else {
      setAmountB(balanceA);
    }
  }

  const handleChange = e => {
    let tmpVal = e.target.value ? e.target.value : 0;
    let id = e.target.id;
    if (tmpVal < 0 || isNaN(tmpVal)) {
      tmpVal = id === 'tokenA' ? amountA : amountB;
    } else if (!(typeof tmpVal === 'string' && (tmpVal.endsWith(".") || tmpVal.startsWith(".")))) {
      tmpVal = Number(e.target.value.toString());
    }
    if (id === 'tokenA') {
      setAmountA(tmpVal);
      if (swapMode !== MODE_SWAP) {
        setAmountB(tmpVal);
      }
      setTokenIndex(indexTokenA);
    } else if (id === 'tokenB') {
      setAmountB(tmpVal);
      if (swapMode !== MODE_SWAP) {
        setAmountA(tmpVal);
      }
      setTokenIndex(indexTokenB);
    }
  }

  const getReceivingAmount = async (amount) => {
    // amount is used for handleMax()
    amount = amount > 0 ? amount : amountA;
    if (amount <= 0) {
      return;
    }
    setLoading(true);
    try {
      const ammRouter = new ethers.Contract(AMMRouterAddress.address, AMMRouterABI.abi, localProvider);
      let max = Number.MIN_SAFE_INTEGER;
      let _bestPath = null;
      for (const path of paths) {
        const _amount = ethers.utils.parseUnits(toString(amount), tokenA.decimals);
        const amounts = await ammRouter.getAmountsOut(_amount, path);
        const _amountB = Number(ethers.utils.formatUnits(amounts[amounts.length - 1], tokenB.decimals));
        if (_amountB > max) {
          max = _amountB;
          _bestPath = path;
        }
      }
      setAmountB(max);
      setBestPath(_bestPath);
      const newPrice = amount / max;
      setPrice(newPrice);
      estimatePriceImpact(ammRouter, _bestPath, newPrice);
    } catch (error) {
      toast.error('Cannot get receiving amount!');
      console.error(error);
    }
    setLoading(false);
  }

  const getSpendingAmount = async () => {
    if (amountB <= 0) {
      return;
    }
    setLoading(true);
    try {
      const ammRouter = new ethers.Contract(AMMRouterAddress.address, AMMRouterABI.abi, localProvider);
      let min = Number.MAX_SAFE_INTEGER;
      let _bestPath = null;
      for (const path of paths) {
        const _amount = ethers.utils.parseUnits(toString(amountB), tokenA.decimals);
        const amounts = await ammRouter.getAmountsIn(_amount, path);
        const _amountA = Number(ethers.utils.formatUnits(amounts[0], tokenA.decimals));
        if (_amountA < min) {
          min = _amountA;
          _bestPath = path;
        }
      }
      setAmountA(min);
      setBestPath(_bestPath);
      const newPrice = min / amountB;
      setPrice(newPrice);
      estimatePriceImpact(ammRouter, _bestPath, newPrice);
    } catch (error) {
      toast.error('Insufficient reserves!');
      console.error(error);
    }
    setLoading(false);
  }

  const printSwapPath = (path) => {
    let result = '';
    if (!path || path.length < 2) {
      return result;
    }
    for (const address of path) {
      result += ` => ${graph.get(address).token.symbol}`;
    }
    return result.substring(4);
  }

  const estimatePriceImpact = async (ammRouter, path, newPrice) => {
    // Get the old price based on existing reserves through the path.
    let oldPrice = 1;
    for (let i = 0; i < path.length - 1; i++) {
      const [reserveA, reserveB,] = await ammRouter.getReserves(path[i], path[i + 1]);
      oldPrice = oldPrice * Number(ethers.utils.formatUnits(reserveA, graph.get(path[i]).token.decimals))
        / Number(ethers.utils.formatUnits(reserveB, graph.get(path[i + 1]).token.decimals));
    }
    setPriceImpact(100 * (newPrice / oldPrice - 1));
  }

  const handleApprove = async () => {
    setLoading(true);
    try {
      const _token = new ethers.Contract(tokenA.address, ERC20ABI, library.getSigner());
      const _allowAmount = ethers.utils.parseUnits(toString(amountA), tokenA.decimals);
      const tx = await _token.approve(AMMRouterAddress.address, _allowAmount);
      await tx.wait();
      toast.info(`${tokenA.symbol} is enabled!`);
      await checkAllowance();
    } catch (error) {
      toast.error(getErrorMessage(error, `Cannot enable ${tokenA.symbol} !`));
      console.error(error);
    }
    setLoading(false);
  }
  const handleSwap = async () => {
    setLoading(true);
    try {
      const ammRouter = new ethers.Contract(AMMRouterAddress.address, AMMRouterABI.abi, library.getSigner());
      const deadline = parseInt(new Date().getTime() / 1000) + 30;
      let tx;
      if (isETH(tokenA)) {
        tx = await (tokenIndex === indexTokenA ?
          ammRouter.swapExactETHForTokens(
            ethers.utils.parseUnits(toString(amountB * 0.9), tokenB.decimals),
            bestPath, account, deadline, {
            value: ethers.utils.parseUnits(toString(amountA), tokenA.decimals)
          }) :
          ammRouter.swapETHForExactTokens(
            ethers.utils.parseUnits(toString(amountB), tokenB.decimals),
            bestPath, account, deadline, {
            value: ethers.utils.parseUnits(toString(amountA * 1.1), tokenA.decimals)
          }));
      } else if (isETH(tokenB)) {
        tx = await (tokenIndex === indexTokenA ?
          ammRouter.swapExactTokensForETH(
            ethers.utils.parseUnits(toString(amountA), tokenA.decimals),
            ethers.utils.parseUnits(toString(amountB * 0.9), tokenB.decimals),
            bestPath, account, deadline) :
          ammRouter.swapTokensForExactETH(
            ethers.utils.parseUnits(toString(amountB), tokenB.decimals),
            ethers.utils.parseUnits(toString(amountA * 1.1), tokenA.decimals),
            bestPath, account, deadline
          ));
      } else {
        tx = await (tokenIndex === indexTokenA ?
          ammRouter.swapExactTokensForTokens(
            ethers.utils.parseUnits(toString(amountA), tokenA.decimals),
            ethers.utils.parseUnits(toString(amountB * 0.9), tokenB.decimals),  // Min acceptable receiving amount
            bestPath, account, deadline) :
          ammRouter.swapTokensForExactTokens(
            ethers.utils.parseUnits(toString(amountB), tokenB.decimals),
            ethers.utils.parseUnits(toString(amountA * 1.1), tokenA.decimals),  // Max acceptable spending amount
            bestPath, account, deadline
          ));
      }
      await tx.wait();
      toast.info(`Swap succeeded! Transaction Hash: ${tx.hash}`)
      setAmountA(0);
      setAmountB(0);
      await getBalances();
      await checkAllowance();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Cannot perform swap!'));
      console.error(error);
    }
    setLoading(false);
  }

  const handleWrap = async () => {
    setLoading(true);
    try {
      const contract = new ethers.Contract(WETH.address, WETHABI.abi, library.getSigner());
      const tx = await (swapMode === MODE_WRAP ?
        contract.deposit({ value: ethers.utils.parseUnits(toString(amountA)) }) :
        contract.withdraw(ethers.utils.parseUnits(toString(amountA))));
      await tx.wait();
      toast.info(`${swapMode === MODE_WRAP ? "wrap" : "unwrap"} succeeded! Transaction Hash: ${tx.hash}`);
      setAmountA(0);
      setAmountB(0);
      await getBalances();
    } catch (error) {
      toast.error(getErrorMessage(error,
        `Cannot perform ${swapMode === MODE_WRAP ? "wrap" : "unwrap"} !`));
      console.error(error);
    }
    setLoading(false);
  }

  return <>
    <Grid container alignItems="center" width="90vw" direction="column">
      <Grid item>
        <Typography variant='h6'>Swap</Typography>
      </Grid>
      <Grid item>
        <Typography>Exchange one token with another token</Typography>
      </Grid>
      <Grid item>
        <Grid container justifyContent="center" spacing="10" sx={{ my: 1 }}>
          <Grid item>
            <Typography sx={theme.component.hintText}>Buy with</Typography>
            <Button sx={theme.component.selectButton}
              endIcon={<KeyboardArrowDownIcon />}
              onClick={() => { setOpenModal(true); setTokenIndex(indexTokenA); }}>
              {Object.keys(tokenA).length === 0 ? "Select a token" : tokenA.symbol}
            </Button>
          </Grid>
          <Grid item>
            <TextField sx={{ mt: 1 }} id="tokenA" label="The amount to spend" value={amountA}
              onChange={handleChange} onBlur={() => swapMode === MODE_SWAP && getReceivingAmount()} />
            <Grid container>
              <Grid item>
                <Typography sx={{ ...theme.component.hintText, mt: 0.4 }}>Balance: {balanceA}</Typography>
              </Grid>
              <Grid item>
                <Button sx={{ fontSize: 12, padding: '0px' }} onClick={() => handleMax()} >Max</Button>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
        <Grid container justifyContent="center" alignItems="center">
          <Fab onClick={() => selectToken(tokenB, tokenA)}
            onMouseEnter={() => setHoverOnSwitch(true)}
            onMouseLeave={() => setHoverOnSwitch(false)}>
            {hoverOnSwitch ? <SwapVertIcon /> : <ArrowDownwardIcon />}
          </Fab>
        </Grid>
        <Grid container justifyContent="center" spacing="10" sx={{ my: 1 }}>
          <Grid item>
            <Typography sx={theme.component.hintText}>You'll get</Typography>
            <Button sx={theme.component.selectButton}
              endIcon={<KeyboardArrowDownIcon />}
              onClick={() => { setOpenModal(true); setTokenIndex(indexTokenB); }}>
              {Object.keys(tokenB).length === 0 ? "Select a token" : tokenB.symbol}
            </Button>
          </Grid>
          <Grid item>
            <TextField sx={{ mt: 1 }} id="tokenB" label="The amount to receive" value={amountB}
              onChange={handleChange} onBlur={() => swapMode === MODE_SWAP && getSpendingAmount()} />
            <Typography sx={theme.component.hintText}>Balance: {balanceB}</Typography>
          </Grid>
        </Grid>
        <Collapse in={price > 0 || swapMode !== MODE_SWAP} sx={{ my: 2 }} >
          {swapMode === MODE_SWAP ? <>
            <Grid container justifyContent="space-between" alignItems="center">
              <Grid item sx={{ fontWeight: 600 }}>Price</Grid>
              <Grid item>{price.toFixed(2)} {tokenA.symbol} per {tokenB.symbol}</Grid>
            </Grid>
            <Grid container justifyContent="space-between" alignItems="center">
              <Grid item sx={{ fontWeight: 600 }}>Price Impact</Grid>
              <Grid item>{priceImpact.toFixed(2)} %</Grid>
            </Grid>
            <Grid container justifyContent="space-between" alignItems="center">
              <Grid item sx={{ fontWeight: 600 }}>Path</Grid>
              <Grid item>{printSwapPath(bestPath)}</Grid>
            </Grid>
          </> : <Typography>
            The exchange rate from {swapMode === MODE_WRAP ? "ETH to WETH" : "WETH to ETH"} is always 1:1
          </Typography>}
        </Collapse>
        <Grid container justifyContent="center" alignItems="center">
          {active ? <Grid item xs={12}>
            {allowAmount < amountA && swapMode === MODE_SWAP && !isETH(tokenA) ?
              <Button sx={theme.component.primaryButton} fullWidth onClick={() => handleApprove()}>
                {loading ? <CircularProgress sx={{ color: 'white' }} /> : `Enable ${tokenA.symbol}`}
              </Button> : <Button disabled={amountA <= 0 || amountB <= 0 || balanceA < amountA || loading}
                fullWidth sx={theme.component.primaryButton} onClick={() => swapMode === MODE_SWAP ? handleSwap() : handleWrap()}>
                {loading ? <CircularProgress sx={{ color: 'white' }} /> : (
                  balanceA < amountA ? "Insufficient Balance" : (swapMode === MODE_SWAP ? "Swap" :
                    (swapMode === MODE_WRAP ? "Wrap" : "Unwrap")))}
              </Button>}
          </Grid> : <Typography>Please connect wallet to swap!</Typography>}
        </Grid>
      </Grid>
    </Grid>
    <TokenSelectModal open={openModal} handleClose={() => setOpenModal(false)} selectToken={token =>
      tokenIndex === indexTokenA ? selectToken(token, tokenB) : selectToken(tokenA, token)
    } />
  </>
}
export default Swap;