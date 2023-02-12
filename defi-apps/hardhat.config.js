require("@nomicfoundation/hardhat-toolbox");

// Go to https://infura.io, sign up, create
// a new App in its dashboard, and replace "KEY" with its key
const INFURA_API_KEY = "c4246efc57c942c0b901ca4c8c75d8c4";

// Replace this private key with your Goerli account private key
// To export your private key from Metamask, open Metamask and
// go to Account Details > Export Private Key
// Beware: NEVER put real Ether into testing accounts
const GOERLI_PRIVATE_KEY = "ca1d8855773f2bff7933ad6e5a7e247108ffcfa4392bce271542fe4e15217e15";

module.exports = {
  solidity: "0.8.17",
  paths: {
    sources: "./src/backend/contracts",
    artifacts: "./src/backend/artifacts",
    cache: "./src/backend/cache",
    tests: "./src/backend/test"
  },
  networks: {
    goerli: {
      url: `https://goerli.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [GOERLI_PRIVATE_KEY]
    }
  }
};
