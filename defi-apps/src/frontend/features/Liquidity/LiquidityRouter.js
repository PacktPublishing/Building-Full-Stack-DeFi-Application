import React from "react";
import { Route, Routes } from "react-router-dom";
import ListLiquidity from "./ListLiquidity";
import AddLiquidity from "./AddLiquidity";
import RemoveLiquidity from "./RemoveLiquidity";
import { Grid } from "@mui/material";

const LiquidityRouter = () => {
  return <Grid container justifyContent="center" width="90vw">
    <Grid item>
      <Routes>
        <Route path="/" element={<ListLiquidity />} />
        <Route path="/add" element={<AddLiquidity />} />
        <Route path="/remove" element={<RemoveLiquidity />} />
      </Routes>
    </Grid>
  </Grid>;
}

export default LiquidityRouter;