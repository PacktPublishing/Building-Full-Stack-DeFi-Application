// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();

  const contractList = [
    // "Contract Name", "Contract Factory Name"
    ["Simple DeFi Token", "SimpleDeFiToken"],
    ["Meme Token", "MemeToken"],
    ["Foo Token", "FooToken"],
    ["Bar Token", "BarToken"],
    ["Wrapped ETH", "WETH"],
    ["Pair Factory", "PairFactory"],
    ["AMM Router", "AMMRouter"],
    ["Staking Pool Manager", "StakingPoolManager"],
    ["Asset Pool Share Deployer", "AssetPoolShareDeployer"],
    ["Price Oracle", "PriceOracle"],
    ["Asset Pool", "AssetPool"],
    ["Pool Configuration", "PoolConfiguration"],
  ];

  let pairFactoryAddress;
  let fooAddress;
  let barAddress;
  let wethAddress;
  let ammRouerAddress;
  let shareDeployerAddress;
  let priceOracleAddress;
  let poolConfAddress;
  let assetPoolContract;

  // Deploying the smart contracts and save contracts to frontend
  for (const [name, factory] of contractList) {
    let contractFactory = await ethers.getContractFactory(factory);
    let contract;
    switch (factory) {
      case "AMMRouter":
        contract = await contractFactory.deploy(pairFactoryAddress, wethAddress);
        break;
      case "PriceOracle":
        contract = await contractFactory.deploy(ammRouerAddress, wethAddress);
        break;
      case "AssetPool":
        contract = await contractFactory.deploy(shareDeployerAddress, priceOracleAddress);
        assetPoolContract = contract;
        break;
      case "PoolConfiguration":
        contract = await contractFactory.deploy(
          "10000000000000000",  // baseBorrowRate = 1%
          "90000000000000000",  // optimalSpan = 9%
          "600000000000000000", // excessSpan = 60%
          "900000000000000000", // optimalUtilizationRate = 90%
          "800000000000000000", // collateralRate = 80%
          "1050000000000000000", // liquidationBonusRate = 105%
        );
        break;
      default:
        contract = await contractFactory.deploy();
    }
    console.log(`${name} Contract Address:`, contract.address);
    switch (factory) {
      case "PairFactory":
        pairFactoryAddress = contract.address;
        break;
      case "WETH":
        wethAddress = contract.address;
        break;
      case "AMMRouter":
        ammRouerAddress = contract.address;
        break;
      case "AssetPoolShareDeployer":
        shareDeployerAddress = contract.address;
        break;
      case "PriceOracle":
        priceOracleAddress = contract.address;
        break;
      case "PoolConfiguration":
        poolConfAddress = contract.address;
        break;
      case "FooToken":
        fooAddress = contract.address;
        break;
      case "BarToken":
        barAddress = contract.address;
        break;
    }
    saveContractToFrontend(contract, factory);
  }

  // Create asset pools for crypto loan and set them to active (1)
  for (let token of [fooAddress, barAddress, wethAddress]) {
    await assetPoolContract.initPool(token, poolConfAddress);
    await assetPoolContract.setPoolStatus(token, 1);
    console.log(`Asset Pool for ${token} is configured`);
  }

  console.log("Deployer: ", deployer.address);
  console.log("Deployer ETH balance: ", (await deployer.getBalance()).toString());
}

function saveContractToFrontend(contract, name) {
  const contractsDir = __dirname + "/../src/frontend/contracts";
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    contractsDir + `/${name}-address.json`,
    JSON.stringify({ address: contract.address }, undefined, 2)
  );

  const contractArtifact = artifacts.readArtifactSync(name);

  fs.writeFileSync(
    contractsDir + `/${name}.json`,
    JSON.stringify(contractArtifact, null, 2)
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
