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

const TokenSelectModal = ({ open, handleClose, selectToken }) => {
  const [tokens, setTokens] = useState([]);

  const getSupportedTokens = useCallback(async () => {
    const _tokens = [];
    for (let address of SuppotedTokens) {
      _tokens.push(await getTokenInfo(address));
    }
    setTokens(_tokens);
  }, []);

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