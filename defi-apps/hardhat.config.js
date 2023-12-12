require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

<<<<<<< HEAD
const SEPOLIA_API_URL = process.env.API_URL;
const SEPOLIA_PRIVATE_KEY = process.env.PRIVATE_KEY;
=======
const GOERLI_API_URL = process.env.API_URL;
const GOERLI_PRIVATE_KEY = process.env.PRIVATE_KEY;
>>>>>>> 9cfd6076e87ab5ebeefb9eb412b764813fd98346

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
