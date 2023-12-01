const { mine } = require("@nomicfoundation/hardhat-network-helpers");
const { task } = require("hardhat/config");

task("mine", "Mine a few blocks with given argument")
  .addPositionalParam("blocks").
  setAction(async (taskArgs) => {
    await mine(parseInt(taskArgs['blocks']));
  });