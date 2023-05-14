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
    ["Pair Factory", "PairFactory"],
    ["AMM Router", "AMMRouter"], // AMMRouter must come after PairFactory
  ];

  let pairFactoryAddress;

  // Deploying the smart contracts and save contracts to frontend
  for (const [name, factory] of contractList) {
    let contractFactory = await ethers.getContractFactory(factory);
    let contract = factory === "AMMRouter" ? await contractFactory.deploy(pairFactoryAddress) : await contractFactory.deploy();
    console.log(`${name} Contract Address:`, contract.address);
    if (factory === "PairFactory") {
      pairFactoryAddress = contract.address;
    }
    saveContractToFrontend(contract, factory);
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
