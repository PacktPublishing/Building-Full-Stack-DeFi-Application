import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  Typography,
} from "@mui/material";
import ClearOutlinedIcon from "@mui/icons-material/ClearOutlined";
import { SuppotedTokens } from "../../utils/Tokens";
import { getTokenInfo } from '../../utils/Helper';
import WETH from '../../contracts/WETH-address.json'

const TokenSelectModal = ({ open, handleClose, selectToken, erc20Only, customTokens }) => {
  const [tokens, setTokens] = useState([]);

  const getSupportedTokens = useCallback(async () => {
    if (customTokens && customTokens.length > 0) {
      setTokens(customTokens);
      return;
    }
    // The native coin of EVM and its wrapped form
    const _tokens = [{
      address: WETH.address,
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }, {
      address: WETH.address,
      name: 'Wrapped ETH',
      symbol: 'WETH',
      decimals: 18
    }];
    if (erc20Only) {
      // Remove the first element since ETH is not an ERC20 token
      _tokens.shift();
    }
    for (let address of SuppotedTokens) {
      _tokens.push(await getTokenInfo(address));
    }
    setTokens(_tokens);
  }, [erc20Only, customTokens]);

  useEffect(() => {
    getSupportedTokens();
  }, [getSupportedTokens])
  return <Dialog open={open} onClose={handleClose}>
    <IconButton onClick={handleClose}><ClearOutlinedIcon /></IconButton>
    <DialogTitle>
      <Typography>Please select a token</Typography>
    </DialogTitle>
    <DialogContent>
      <List>
        {tokens.map((item, index) =>
          <ListItem key={index}
            sx={{ "&: hover": { background: "#1976d2", cursor: "pointer" } }}
            onClick={() => { handleClose(); selectToken(item); }}>
            <Typography>{item.name} ({item.symbol})</Typography>
          </ListItem>)
        }
      </List>
    </DialogContent>
  </Dialog>
}

export default TokenSelectModal;