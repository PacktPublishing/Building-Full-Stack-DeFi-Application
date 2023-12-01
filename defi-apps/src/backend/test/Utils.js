const { ethers } = require("hardhat");
const toWei = (num) => ethers.utils.parseEther(num.toString());
const fromWei = (num) => ethers.utils.formatEther(num);
const delay = ms => new Promise(res => setTimeout(res, ms));
exports.toWei = toWei;
exports.fromWei = fromWei;
exports.delay = delay;