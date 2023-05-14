import { localProvider } from '../components/Wallet';
import { ethers } from 'ethers';
import { ERC20ABI } from './ERC20ABI';

export const getTokenInfo = async (address) => {
  let name = "Unknown", symbol = "Unknown", decimals = 18;
  try {
    const contract = new ethers.Contract(address, ERC20ABI, localProvider);
    name = await contract.name();
    symbol = await contract.symbol();
    decimals = await contract.decimals();
  } catch (error) {
    console.error(error);
  }
  return { address, name, symbol, decimals };
}

export const ERROR_CODE = {
  'ACTION_REJECTED': 'Action rejected by user!'
}

export const getErrorMessage = (error, defaultMessage) => {
  return ERROR_CODE[error.code] || defaultMessage;
}

export const toString = x => {
  if (Math.abs(x) < 1.0) {
    let e = parseInt(x.toString().split('e-')[1]);
    if (e) {
      x *= Math.pow(10, e - 1);
      x = '0.' + (new Array(e)).join('0') + x.toString().substring(2);
    }
  } else {
    let e = parseInt(x.toString().split('+')[1]);
    if (e > 20) {
      e -= 20;
      x /= Math.pow(10, e);
      x += (new Array(e + 1)).join('0');
    }
  }
  return x.toString();
}