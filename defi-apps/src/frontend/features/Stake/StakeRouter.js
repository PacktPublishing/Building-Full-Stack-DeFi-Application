import React from "react";
import { Route, Routes } from "react-router-dom";
import { Grid } from "@mui/material";
import ListStakingPools from "./ListStakingPools";
import CreateStakingPool from "./CreateStakingPool";
import SupplyStakingReward from "./SupplyStakingReward";
import Deposit from "./Deposit";
import Withdraw from "./Withdraw";

const StakeRouter = () => {
  return <Grid container justifyContent="center" width="90vw">
    <Grid item>
      <Routes>
        <Route path="/" element={<ListStakingPools />} />
        <Route path="/create" element={<CreateStakingPool />} />
        <Route path="/supply" element={<SupplyStakingReward />} />
        <Route path="/deposit" element={<Deposit />} />
        <Route path="/withdraw" element={<Withdraw />} />
      </Routes>
    </Grid>
  </Grid>
}

export default StakeRouter;