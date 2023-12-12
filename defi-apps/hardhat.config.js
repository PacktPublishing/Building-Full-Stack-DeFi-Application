require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

const SEPOLIA_API_URL = process.env.API_URL;
const SEPOLIA_PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
  solidity: "0.8.17",
  paths: {
    sources: "./src/backend/contracts",
    artifacts: "./src/backend/artifacts",
    cache: "./src/backend/cache",
    tests: "./src/backend/test"
  },
  networks: {
    sepolia: {
      url: SEPOLIA_API_URL,
      accounts: [SEPOLIA_PRIVATE_KEY]
    }
  }
};
