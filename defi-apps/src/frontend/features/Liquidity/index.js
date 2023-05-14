import React from "react";
import { Route, Routes } from "react-router-dom";
import ListLiquidity from "./ListLiquidity";
import AddLiquidity from "./AddLiquidity";
import RemoveLiquidity from "./RemoveLiquidity";

const LiquidityRouter = () => {
  return <Routes>
    <Route path="/" element={<ListLiquidity />} />
    <Route path="/add" element={<AddLiquidity />} />
    <Route path="/remove" element={<RemoveLiquidity />} />
  </Routes>
}

export default LiquidityRouter;