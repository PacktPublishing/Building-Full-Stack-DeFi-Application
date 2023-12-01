import { Web3Provider } from '@ethersproject/providers';
import { InjectedConnector } from "@web3-react/injected-connector";
import { WalletConnectConnector } from "@web3-react/walletconnect-connector";
import { Buffer } from "buffer";
import { ethers } from 'ethers';

if (!window.Buffer) {
  window.Buffer = Buffer;
}

export const getLibrary = provider => {
  return new Web3Provider(provider);
}

export const GOERLI_NETWORK_ID = 5;

export const injectedConnector = new InjectedConnector({ supportedChainIds: [1, 3, 4, 5, 42, 31337] });

export const walletConnectConnector = new WalletConnectConnector({
  rpc: { [GOERLI_NETWORK_ID]: process.env.REACT_APP_API_URL },
  qrcode: true,
});

export const localProvider = new ethers.providers.JsonRpcProvider(process.env.REACT_APP_LOCAL_RPC_URL);