import React from "react";
import { Route, Routes } from "react-router-dom";
import { Grid } from "@mui/material";
import ListFarmingPools from "./ListFarmingPools";
import CreateFarmingPool from "./CreateFarmingPool";
import SupplyFarmingReward from "./SupplyFarmingReward";
import Deposit from "./Deposit";
import Withdraw from "./Withdraw";

const FarmRouter = () => {
  return <Grid container justifyContent="center" width="90vw">
    <Grid item>
      <Routes>
        <Route path="/" element={<ListFarmingPools />} />
        <Route path="/create" element={<CreateFarmingPool />} />
        <Route path="/supply" element={<SupplyFarmingReward />} />
        <Route path="/deposit" element={<Deposit />} />
        <Route path="/withdraw" element={<Withdraw />} />
      </Routes>
    </Grid>
  </Grid>;
}

export default FarmRouter;