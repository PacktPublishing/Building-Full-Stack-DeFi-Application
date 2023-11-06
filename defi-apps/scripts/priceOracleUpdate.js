// Update price oracle at least once per period
const { ethers } = require("hardhat");
const { delay, fromWei } = require("../src/backend/test/Utils");
const oracleAddress = require("../src/frontend/contracts/PriceOracleV2-address.json");
const wethAddress = require("../src/frontend/contracts/WETH-address.json");
const fooAddress = require("../src/frontend/contracts/FooToken-address.json");
const barAddress = require("../src/frontend/contracts/BarToken-address.json");

msWait = 5000

async function main() {
  const [, , , oracleAdmin] = await ethers.getSigners();
  let oracleFactory = await ethers.getContractFactory("PriceOracleV2");
  let oracleContract = oracleFactory.attach(oracleAddress.address);
  while (true) {
    await oracleContract.connect(oracleAdmin).update(wethAddress.address, fooAddress.address);
    await oracleContract.connect(oracleAdmin).update(wethAddress.address, barAddress.address);

    try {
      console.log(`${new Date().toLocaleString()} at block ${await ethers.provider.getBlockNumber()}:
      FOO Price: ${fromWei(await oracleContract.getPriceInWETH(fooAddress.address))} ETH,
      BAR Price: ${fromWei(await oracleContract.getPriceInWETH(barAddress.address))} ETH,
      ETH Balance: ${fromWei(await oracleAdmin.getBalance())}`);
    } catch (error) {
      console.log(error.errorArgs);
    }

    await delay(msWait);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});