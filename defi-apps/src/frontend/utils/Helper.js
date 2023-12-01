import { localProvider } from '../components/Wallet';
import { ethers } from 'ethers';
import { ERC20ABI } from './ERC20ABI';
import FactoryABI from '../contracts/PairFactory.json';
import FactoryAddress from '../contracts/PairFactory-address.json';
import { TokenPairABI } from './TokenPairABI';
import WETH from '../contracts/WETH-address.json';

export const getTokenInfo = async (address) => {
  let name = "Unknown", symbol = "Unknown", decimals = 18;
  if (address === WETH.address) {
    // Shortcut for Ether
    return { address, name: "Ether", symbol: "ETH", decimals: 18 };
  }
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

export const getLiquidityPools = async () => {
  const pools = new Map();
  try {
    const factory = new ethers.Contract(FactoryAddress.address, FactoryABI.abi, localProvider);
    const nPairs = await factory.allPairsLength();
    for (let i = 0; i < nPairs; i++) {
      const address = await factory.allPairs(i);
      const tokenPair = new ethers.Contract(address, TokenPairABI, localProvider);
      const tokenA = await getTokenInfo(await tokenPair.tokenA());
      const tokenB = await getTokenInfo(await tokenPair.tokenB());
      pools.set(address, { tokenA, tokenB });
    }
  } catch (error) {
    console.error(error);
  }
  return pools;
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

// Check if a token object is ETH
export const isETH = token => {
  return token.address === WETH.address && token.symbol === 'ETH';
}

// Format BigNumber interst to percentage
export const formatInterest = interest => {
  return (Number(ethers.utils.formatEther(interest)) * 100).toFixed(2) + "%";
}

export const formatEtherOrNA = value => {
  return value ? Number(ethers.utils.formatEther(value)).toFixed(2) : 'N/A';
}

export const boolOrNA = value => {
  return value === undefined || value === null ? 'N/A' : value.toString();
}