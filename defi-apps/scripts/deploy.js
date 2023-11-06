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
    ["Price Oracle v2", "PriceOracleV2"],
    ["Pool Configuration", "PoolConfiguration"],
    ["Asset Pool", "AssetPool"],
  ];

  let pairFactory, ammRouter, fooToken, barToken, wethToken,
    shareDeployer, priceOracle, poolConf, assetPool;

  // Deploying the smart contracts and save contracts to frontend
  for (const [name, factory] of contractList) {
    let contractFactory = await ethers.getContractFactory(factory);
    let contract;
    switch (factory) {
      case "FooToken":
        fooToken = contract = await contractFactory.deploy();
        break;
      case "BarToken":
        barToken = contract = await contractFactory.deploy();
        break;
      case "PairFactory":
        pairFactory = contract = await contractFactory.deploy();
        break;
      case "WETH":
        wethToken = contract = await contractFactory.deploy();
        break;
      case "AMMRouter":
        ammRouter = contract = await contractFactory.deploy(pairFactory.address, wethToken.address);
        break;
      case "AssetPoolShareDeployer":
        shareDeployer = contract = await contractFactory.deploy();
        break;
      case "PriceOracleV2":
        priceOracle = contract = await contractFactory.deploy(pairFactory.address, wethToken.address, 60, 5);
        break;
      case "AssetPool":
        assetPool = contract = await contractFactory.deploy(shareDeployer.address, priceOracle.address);
        break;
      case "PoolConfiguration":
        poolConf = contract = await contractFactory.deploy(
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
    saveContractToFrontend(contract, factory);
  }

  for (let token of [wethToken, fooToken, barToken]) {
    // Set allowance of token for AMM Router
    await token.approve(ammRouter.address, '1000000000000000000000000000');

    if (token != wethToken) {
      // Create token pair TOKEN/WETH and supply 10 TOKENs and 1 WETH as initial liquidity.
      await ammRouter.addLiquidityETH(token.address, '10000000000000000000',
        0, 0, deployer.address, parseInt(new Date().getTime() / 1000) + 10000,
        { value: '1000000000000000000' });
      console.log(`Liquidity pool for ${await token.symbol()}/WETH created`);
    }

    // Create asset pools for crypto loan and
    await assetPool.initPool(token.address, poolConf.address);

    // set them to active (1)
    await assetPool.setPoolStatus(token.address, 1);
    console.log(`Asset Pool for ${await token.symbol()} is configured`);
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
