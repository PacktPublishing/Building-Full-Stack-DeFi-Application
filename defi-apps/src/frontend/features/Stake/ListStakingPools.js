import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from "react-router-dom";
import {
  Grid, useTheme, Button, Accordion, AccordionSummary, AccordionDetails,
  Typography, CircularProgress, FormControlLabel, FormGroup, Checkbox
} from '@mui/material';
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { toast } from 'react-toastify';
import { useWeb3React } from "@web3-react/core";
import { ethers } from 'ethers';
import ManagerAddress from '../../contracts/StakingPoolManager-address.json';
import ManagerABI from '../../contracts/StakingPoolManager.json';
import { StakingPoolABI } from '../../utils/StakingPoolABI';
import { getTokenInfo, getLiquidityPools } from '../../utils/Helper';

const ListStakingPools = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { active, account, library } = useWeb3React();
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [stakingPools, setStakingPools] = useState([]);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [hideExpired, setHideExpired] = useState(false);

  const getStakingPools = useCallback(async () => {
    try {
      const signer = library.getSigner();
      const stakingPoolManager = new ethers.Contract(ManagerAddress.address, ManagerABI.abi, signer);
      // Get all staking pool addresses from staking pool manager
      const stakingPools = await stakingPoolManager.getAllStakingPools();
      const pools = [];
      const liquidityPools = await getLiquidityPools();
      for (const address of stakingPools) {
        const stakingPool = new ethers.Contract(address, StakingPoolABI, signer);
        const stakedTokenAddress = await stakingPool.stakedToken();
        if (liquidityPools.has(stakedTokenAddress)) {
          // Skip farming pools
          continue;
        }
        const rewardStartBlock = await stakingPool.rewardStartBlock();
        const rewardEndBlock = await stakingPool.rewardEndBlock();
        const rewardPerBlock = await stakingPool.rewardPerBlock();
        const stakedToken = await getTokenInfo(stakedTokenAddress);
        const rewardToken = await getTokenInfo(await stakingPool.rewardToken());
        const stakedAmount = (await stakingPool.userInfo(account)).amount;
        const stakedTotal = await stakingPool.stakedTokenSupply();
        const pendingReward = await stakingPool.getPendingReward(account);

        pools.push({
          address, rewardStartBlock, rewardEndBlock, rewardPerBlock,
          stakedToken, rewardToken, stakedAmount, pendingReward, stakedTotal
        });
      }
      setStakingPools(pools);
    } catch (error) {
      toast.error("Cannot fetch staking pools!");
      console.error(error);
    }
  }, [account, library]);

  const handleHarvest = async (address) => {
    setLoading(true);
    try {
      const stakingPool = new ethers.Contract(address, StakingPoolABI, library.getSigner());
      const tx = await stakingPool.deposit(0);
      await tx.wait();
      toast.info(`Successfully harvest reward token! Transaction hash: ${tx.hash}`);
      library.getBlockNumber().then(number => setCurrentBlock(number));
      await getStakingPools();
    } catch (error) {
      toast.error("Cannot harvest token!");
      console.error(error);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (active) {
      library.getBlockNumber().then(number => setCurrentBlock(number));
      getStakingPools();
    }
  }, [active, library, getStakingPools]);

  const handleClick = (item) => async (event, isExpanded) => {
    setExpanded(isExpanded ? item.address : false);
  }

  const handleHideExpired = (event) => {
    setHideExpired(event.target.checked);
  }

  console.log(currentBlock);

  return <>
    <Grid container direction="column">
      {active ? <>
        <FormGroup sx={{ width: "50vw" }}>
          <FormControlLabel label="Hide Expired Pools" control={<Checkbox checked={hideExpired} onChange={handleHideExpired} />} />
        </FormGroup>
        {stakingPools.length > 0 ? stakingPools.filter(p => hideExpired ? p.rewardEndBlock > currentBlock : true).map((item, index) =>
          <Accordion
            key={`staking-pool-${index}`}
            expanded={expanded === item.address}
            onChange={handleClick(item)}
            sx={{ border: 2, my: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="panel1a-content">
              <Grid container spacing={2}>
                <Grid item>Stake: {item.stakedToken.symbol}</Grid>
                <Grid item>Earn: {item.rewardToken.symbol}</Grid>
                <Grid item>{item.rewardToken.symbol} Earned: {ethers.utils.formatUnits(item.pendingReward, item.rewardToken.decimals)}</Grid>
                <Grid item>Total Staked: {ethers.utils.formatUnits(item.stakedTotal, item.stakedToken.decimals)}</Grid>
                <Grid item>Reward Per Block: {ethers.utils.formatUnits(item.rewardPerBlock, item.rewardToken.decimals)}</Grid>
                <Grid item>{currentBlock >= item.rewardEndBlock ? "Expired" :
                  (currentBlock >= item.rewardStartBlock ? `Ends in ${item.rewardEndBlock - currentBlock} block(s)` :
                    `Starts in ${item.rewardStartBlock - currentBlock} block(s)`)}</Grid>
              </Grid>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item md={3} xs={6}>
                  <Button sx={theme.component.primaryButton} fullWidth disabled={currentBlock >= item.rewardEndBlock}
                    onClick={() => navigate(`deposit?pool=${item.address}`)}>Deposit</Button>
                </Grid>
                <Grid item md={3} xs={6}>
                  <Button sx={theme.component.primaryButton} fullWidth disabled={item.stakedAmount.lte(0)}
                    onClick={() => navigate(`withdraw?pool=${item.address}`)}>Withdraw</Button>
                </Grid>
                <Grid item md={3} xs={6}>
                  <Button sx={theme.component.primaryButton} fullWidth disabled={item.pendingReward.lte(0)} onClick={() => handleHarvest(item.address)}>
                    {loading ? <CircularProgress /> :
                      `Harvest ${ethers.utils.formatUnits(item.pendingReward, item.rewardToken.decimals)} ${item.rewardToken.symbol}`}
                  </Button>
                </Grid>
                <Grid item md={3} xs={6}>
                  <Button sx={theme.component.primaryButton} fullWidth
                    onClick={() => navigate(`supply?pool=${item.address}`)}>Supply Reward</Button>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>) : <Typography>No Staking Pool Found</Typography>}
      </> : <Typography>Please connect to a wallet to view staking pools.</Typography>}
    </Grid>
    {active && <Grid container sx={{ mt: 2 }}>
      <Grid item xs={12}>
        <Button sx={theme.component.primaryButton} fullWidth onClick={
          () => navigate("create")
        }>Create Staking Pool</Button>
      </Grid>
    </Grid>}
  </>;
}

export default ListStakingPools;