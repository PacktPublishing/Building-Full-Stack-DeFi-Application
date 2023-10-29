import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeb3React } from "@web3-react/core";
import { Button, Divider, Grid, Typography, useTheme, TextField, IconButton, CircularProgress } from '@mui/material';
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { toast } from 'react-toastify';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import TokenSelectModal from '../../components/TokenSelectModal';
import { ethers } from 'ethers';
import ManagerAddress from '../../contracts/StakingPoolManager-address.json';
import ManagerABI from '../../contracts/StakingPoolManager.json';
import { toString } from '../../utils/Helper';

const CreateStakingPool = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { active, library } = useWeb3React();
  const [stakedToken, setStakedToken] = useState({});
  const [rewardToken, setRewardToken] = useState({});
  const [rewardPerBlock, setRewardPerBlock] = useState(100);
  const [startBlock, setStartBlock] = useState(0);
  const [endBlock, setEndBlock] = useState(0);
  const [tokenIndex, setTokenIndex] = useState(0); // 0 = stakedToken, 1 = rewardToken
  const [openModal, setOpenModal] = useState(false);
  const [tokensSelected, setTokensSelected] = useState(false);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [loading, setLoading] = useState(false);
  const [indexStakedToken, indexRewardToken] = [0, 1];

  const handleSelectToken = token => {
    if (tokenIndex === indexStakedToken) {
      setStakedToken(token);
      setTokensSelected(Object.keys(rewardToken).length > 0);
    } else if (tokenIndex === indexRewardToken) {
      setRewardToken(token);
      setTokensSelected(Object.keys(stakedToken).length > 0);
    } else {
      toast.error("Shouldn't reach here, unsupported token index!");
    }
  }

  const handleChange = e => {
    let tmpVal = e.target.value ? e.target.value : 0;
    let id = e.target.id;
    if (tmpVal < 0 || (isNaN(tmpVal) && id !== 'reward_per_block')) {
      tmpVal = e.target.value;
    } else if (!(typeof tmpVal === 'string' && (tmpVal.endsWith(".") || tmpVal.startsWith(".")))) {
      tmpVal = Number(e.target.value.toString());
    }
    if (id === 'reward_per_block') {
      setRewardPerBlock(tmpVal);
    } else if (id === 'start_block') {
      setStartBlock(tmpVal);
    } else if (id === 'end_block') {
      setEndBlock(tmpVal);
    }
  }

  const handleCreate = async () => {
    setLoading(true);
    try {
      const stakingPoolManager = new ethers.Contract(ManagerAddress.address, ManagerABI.abi, library.getSigner());
      const tx = await stakingPoolManager.createStakingPool(stakedToken.address, rewardToken.address,
        ethers.utils.parseUnits(toString(rewardPerBlock), rewardToken.decimals), startBlock, endBlock);
      await tx.wait();
      toast.info(`Staking pool is created successfully! Transaction Hash: ${tx.hash}`);
      setStakedToken({});
      setRewardToken({});
      setRewardPerBlock(100);
      setStartBlock(0);
      setEndBlock(0);
      library.getBlockNumber().then(number => setCurrentBlock(number));
    } catch (error) {
      toast.error("Cannot create staking pool!");
      console.error(error);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (active) {
      library.getBlockNumber().then(number => setCurrentBlock(number));
    }
  }, [active, library]);

  return (active ? <Grid container sx={{ width: { xs: "90vw", md: "40vw" } }}>
    <Grid item>
      <Grid container columnGap={12}>
        <Grid item>
          <IconButton onClick={() => { navigate('..', { replace: true }) }}>
            <ArrowBackIcon />
          </IconButton>
        </Grid>
        <Grid item>
          <Typography sx={{ mt: 1 }}>Create Staking Pool</Typography>
        </Grid>
      </Grid>
      <Divider sx={theme.component.divider} />
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Typography sx={{ mt: 2 }} >Staked Token</Typography>
        </Grid>
        <Grid item xs={6}>
          <Button
            sx={theme.component.selectButton}
            endIcon={<KeyboardArrowDownIcon />}
            onClick={() => { setOpenModal(true); setTokenIndex(0); }}
          >
            {Object.keys(stakedToken).length === 0 ? "Select a token" : stakedToken.symbol}
          </Button>
        </Grid>
        <Grid item xs={6}>
          <Typography sx={{ mt: 2 }} >Reward Token</Typography>
        </Grid>
        <Grid item xs={6}>
          <Button
            sx={theme.component.selectButton}
            endIcon={<KeyboardArrowDownIcon />}
            onClick={() => { setOpenModal(true); setTokenIndex(1); }}
          >
            {Object.keys(rewardToken).length === 0 ? "Select a token" : rewardToken.symbol}
          </Button>
        </Grid>
        <Grid item xs={6}>
          <Typography sx={{ mt: 2 }} >Reward Per Block</Typography>
        </Grid>
        <Grid item xs={6}>
          <TextField id="reward_per_block" label="Please enter reward per block" value={rewardPerBlock}
            onChange={handleChange} />
        </Grid>
        <Grid item xs={6}>
          <Typography sx={{ mt: 2 }} >Start Block</Typography>
        </Grid>
        <Grid item xs={6}>
          <TextField id="start_block" label="Please enter start block number" value={startBlock}
            onChange={handleChange} />
        </Grid>
        <Grid item xs={6}>
          <Typography sx={{ mt: 2 }} >End Block</Typography>
        </Grid>
        <Grid item xs={6}>
          <TextField id="end_block" label="Please enter end block number" value={endBlock}
            onChange={handleChange} />
        </Grid>
        <Grid item xs={12}>
          <Typography variant="h5">Note</Typography>
          <Typography>We highly recommend setting block number greater than the current block number {currentBlock}.</Typography>
          {startBlock >= endBlock && <Typography sx={{ color: 'red' }}>Start block number should be less than the end block number.</Typography>}
          {!tokensSelected && <Typography sx={{ color: 'red' }}>Please select both staked and reward tokens.</Typography>}
        </Grid>
        <Grid item xs={4}></Grid>
        <Grid item xs={4}>
          <Button disabled={startBlock >= endBlock || !tokensSelected} sx={theme.component.primaryButton} fullWidth onClick={() => handleCreate()}>
            {loading ? <CircularProgress sx={{ color: 'white' }} /> : "Create"}
          </Button>
        </Grid>
        <Grid item xs={4}></Grid>
      </Grid>
      <TokenSelectModal open={openModal}
        handleClose={() => setOpenModal(false)}
        selectToken={handleSelectToken}
        erc20Only={true}
      />
    </Grid>
  </Grid> : <Typography>Please connect to a wallet to create staking pool</Typography>);
}
export default CreateStakingPool;