require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();
require('./scripts/mine');

const GOERLI_API_URL = process.env.API_URL;
const GOERLI_PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  paths: {
    sources: "./src/backend/contracts",
    artifacts: "./src/backend/artifacts",
    cache: "./src/backend/cache",
    tests: "./src/backend/test"
  },
  networks: {
    goerli: {
      url: GOERLI_API_URL,
      accounts: [GOERLI_PRIVATE_KEY]
    }
  },
};
