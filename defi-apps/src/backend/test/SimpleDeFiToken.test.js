const { expect } = require("chai");
const { ethers } = require("hardhat");
const { toWei, fromWei } = require("./Utils");

describe("SimpleDeFiToken", () => {
  let deployer, user1, user2, token;
  beforeEach(async () => {
    [deployer, user1, user2] = await ethers.getSigners();
    const tokenContractFactory = await ethers.getContractFactory("SimpleDeFiToken");
    token = await tokenContractFactory.deploy();
  });

  it("Should have correct name, symbol and total supply", async () => {
    expect(await token.name()).to.equal("Simple DeFi Token");
    expect(await token.symbol()).to.equal("SDFT");
    expect(await token.totalSupply()).to.equal(toWei(1000000));
  });

  it("Should transfer token from one to another", async () => {
    expect(await token.balanceOf(deployer.address)).to.equal(toWei(1000000));
    await token.connect(deployer).transfer(user1.address, toWei(5));
    expect(await token.balanceOf(user1.address)).to.equal(toWei(5));
    expect(await token.balanceOf(deployer.address)).to.equal(toWei(999995));

    // Cannot transfer when tranfer amount exceed the balance
    await expect(token.connect(user1).transfer(user2.address, toWei(10)))
      .to.be.revertedWith("ERC20: transfer amount exceeds balance");
    expect(await token.balanceOf(user1.address)).to.equal(toWei(5));
    expect(await token.balanceOf(user2.address)).to.equal(toWei(0));
  });

  it("Should burn token automatically when calling transferWithAutoBurn", async () => {
    await token.connect(deployer).transfer(user1.address, toWei(1));
    await token.connect(user1).transferWithAutoBurn(user2.address, toWei(1));
  });
});