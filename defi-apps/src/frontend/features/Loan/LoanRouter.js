import { Route, Routes } from "react-router-dom";
import { Grid } from "@mui/material";
import ListAssetPools from "./ListAssetPools";
import Deposit from "./Deposit";
import Withdraw from "./Withdraw";
import Borrow from "./Borrow";
import Repay from "./Repay";

const LoanRouter = () => {
  return <Grid container justifyContent="center" width="90vw">
    <Grid item>
      <Routes>
        <Route path="/" element={<ListAssetPools />} />
        <Route path="/deposit" element={<Deposit />} />
        <Route path="/withdraw" element={<Withdraw />} />
        <Route path="/borrow" element={<Borrow />} />
        <Route path="/repay" element={<Repay />} />
      </Routes>
    </Grid>
  </Grid>
}

export default LoanRouter;