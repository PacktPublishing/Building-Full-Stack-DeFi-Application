import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from "react-router-dom";
import {
  Grid, useTheme, Button, Accordion, AccordionSummary, AccordionDetails,
  Typography, CircularProgress
} from '@mui/material';
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { toast } from 'react-toastify';
import { useWeb3React } from "@web3-react/core";
import { ethers } from 'ethers';
import AssetPoolAddress from '../../contracts/AssetPool-address.json';
import FooAddress from '../../contracts/FooToken-address.json';
import BarAddress from '../../contracts/BarToken-address.json';
import WETHAddress from '../../contracts/WETH-address.json';
import AssetPoolABI from '../../contracts/AssetPool.json';
import { getTokenInfo, formatInterest, formatEtherOrNA, boolOrNA } from '../../utils/Helper';

const ListAssetPools = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { active, account, library } = useWeb3React();
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [userInfo, setUserInfo] = useState({});
  const [pools, setPools] = useState([]);
  const [INACTIVE, ACTIVE] = [0, 1]; // Pool status

  const getPools = useCallback(async (assetPool) => {
    try {
      const _pools = [];
      for (const tokenAddress of [WETHAddress.address, FooAddress.address, BarAddress.address]) {
        const poolInfo = await assetPool.getPool(tokenAddress);
        const userPoolData = await assetPool.getUserPoolData(account, tokenAddress);
        _pools.push({
          assetToken: WETHAddress.address === tokenAddress ? {
            address: tokenAddress, name: "Wrapped ETH", symbol: "WETH", decimals: 18
          } : await getTokenInfo(tokenAddress),
          borrowInterest: poolInfo.borrowRate,
          lendingInterest: poolInfo.lendingRate,
          totalLiquidity: poolInfo.totalLiquidity,
          availableLiquidity: poolInfo.availableLiquidity,
          liquidityBalance: userPoolData.compoundedLiquidityBalance,
          BorrowBalance: userPoolData.compoundedBorrowBalance,
          status: poolInfo.status,
        })
      }
      setPools(_pools);
    } catch (error) {
      toast.error("Cannot fetch pool information!");
      console.error(error);
    }
  }, [account]);

  const getUserInfo = useCallback(async (assetPool) => {
    try {
      const userInfo = await assetPool.getUserInfo(account);
      const isAccountHealthy = await assetPool.isAccountHealthy(account);
      setUserInfo({
        totalDeposit: userInfo.totalLiquidityValue,
        totalBorrow: userInfo.totalBorrowedValue,
        maxBorrowable: userInfo.totalCollateralValue,
        isAccountHealthy,
      });
    } catch (error) {
      toast.error("Cannot fetch user information!");
      console.error(error);
    }
  }, [account]);

  const loadPoolsAndUserInfo = useCallback(async () => {
    setLoading(true);
    try {
      const signer = library.getSigner();
      const assetPool = new ethers.Contract(AssetPoolAddress.address, AssetPoolABI.abi, signer);
      await getPools(assetPool);
      await getUserInfo(assetPool);
    } catch (error) {
      toast.error("Failed to load asset pool!");
      console.error(error);
    }
    setLoading(false);
  }, [getPools, getUserInfo, library]);

  useEffect(() => {
    if (active) {
      loadPoolsAndUserInfo();
    }
  }, [active, loadPoolsAndUserInfo]);

  const handleChange = address => async (event, isExpanded) => {
    setExpanded(isExpanded ? address : false);
  };

  return <Grid container direction="column">
    {active ? (loading ? <CircularProgress /> : <>
      <Grid container spacing={2} sx={{ py: 2 }}>
        <Grid item md={6}>
          Total Deposit Value: {formatEtherOrNA(userInfo.totalDeposit)} ETH
        </Grid>
        <Grid item md={6}>
          Total Borrowed Value: {formatEtherOrNA(userInfo.totalBorrow)} ETH
        </Grid>
        <Grid item md={6}>
          Maximum Borrowable Value: {formatEtherOrNA(userInfo.maxBorrowable)} ETH
        </Grid>
        <Grid item md={6}>
          Is Account Healthy: {boolOrNA(userInfo.isAccountHealthy)}
        </Grid>
      </Grid>
      {pools.length > 0 ? pools.map((pool, index) =>
        <Accordion key={`asset-pool-${index}`}
          expanded={expanded === pool.assetToken.address}
          onChange={handleChange(pool.assetToken.address)}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Grid container spacing={2}>
              <Grid item>{pool.assetToken.name} ({pool.assetToken.symbol})</Grid>
              <Grid item>Lending APY: {formatInterest(pool.lendingInterest)}</Grid>
              <Grid item>Borrowing APY: {formatInterest(pool.borrowInterest)}</Grid>
            </Grid>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item md={6}>
                Total Liquidity: {Number(ethers.utils.formatUnits(pool.totalLiquidity, pool.assetToken.decimals)).toFixed(4)}
              </Grid>
              <Grid item md={6}>
                Available Liquidity: {Number(ethers.utils.formatUnits(pool.availableLiquidity, pool.assetToken.decimals)).toFixed(4)}
              </Grid>
              <Grid item md={6}>
                Lent Balance : {Number(ethers.utils.formatUnits(pool.liquidityBalance, pool.assetToken.decimals)).toFixed(4)}
              </Grid>
              <Grid item md={6}>
                Borrowed Balance: {Number(ethers.utils.formatUnits(pool.BorrowBalance, pool.assetToken.decimals)).toFixed(4)}
              </Grid>
            </Grid>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item md={3} xs={6}>
                <Button sx={theme.component.primaryButton} fullWidth disabled={pool.status !== ACTIVE}
                  onClick={() => navigate(`deposit?token=${pool.assetToken.address}`)}>Deposit</Button>
              </Grid>
              <Grid item md={3} xs={6}>
                <Button sx={theme.component.primaryButton} fullWidth disabled={pool.status === INACTIVE}
                  onClick={() => navigate(`withdraw?token=${pool.assetToken.address}`)}>Withdraw</Button>
              </Grid>
              <Grid item md={3} xs={6}>
                <Button sx={theme.component.primaryButton} fullWidth disabled={pool.status !== ACTIVE}
                  onClick={() => navigate(`borrow?token=${pool.assetToken.address}`)}>Borrow</Button>
              </Grid>
              <Grid item md={3} xs={6}>
                <Button sx={theme.component.primaryButton} fullWidth disabled={pool.status === INACTIVE}
                  onClick={() => navigate(`repay?token=${pool.assetToken.address}`)}>Repay</Button>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>) : <Typography>Cannot load asset pools!</Typography>}</>) :
      <Typography>Please connect to a wallet to view staking pools.</Typography>}
  </Grid>;
};

export default ListAssetPools;