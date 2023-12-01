const { expect } = require("chai");
const { ethers } = require("hardhat");
const { toWei, delay } = require("./Utils");

describe("AssetPool", () => {
  let deployer, user1, user2, pairFactory, ammRouter, fooToken, barToken, wethToken,
    shareDeployer, priceOracle, poolConf, assetPool;

  beforeEach(async () => {
    [deployer, user1, user2] = await ethers.getSigners();

    // Deploying the smart contracts
    for (const factory of ["FooToken", "BarToken", "WETH", "PairFactory", "AMMRouter",
      "AssetPoolShareDeployer", "PriceOracle", "AssetPool", "PoolConfiguration"]) {
      let contractFactory = await ethers.getContractFactory(factory);
      switch (factory) {
        case "FooToken":
          fooToken = await contractFactory.deploy();
          break;
        case "BarToken":
          barToken = await contractFactory.deploy();
          break;
        case "PairFactory":
          pairFactory = await contractFactory.deploy();
          break;
        case "WETH":
          wethToken = await contractFactory.deploy();
          break;
        case "AMMRouter":
          ammRouter = await contractFactory.deploy(pairFactory.address, wethToken.address);
          break;
        case "AssetPoolShareDeployer":
          shareDeployer = await contractFactory.deploy();
          break;
        case "PriceOracle":
          priceOracle = await contractFactory.deploy(ammRouter.address, wethToken.address);
          break;
        case "AssetPool":
          assetPool = await contractFactory.deploy(shareDeployer.address, priceOracle.address);
          break;
        case "PoolConfiguration":
          poolConf = await contractFactory.deploy(
            "10000000000000000",  // baseBorrowRate = 1%
            "90000000000000000",  // optimalSpan = 9%
            "600000000000000000", // excessSpan = 60%
            "900000000000000000", // optimalUtilizationRate = 90%
            "800000000000000000", // collateralRate = 80%
            "1050000000000000000", // liquidationBonusRate = 105%
          );
          break;
      }
    }

    for (let token of [wethToken, fooToken, barToken]) {
      // Set allowance of token for AMM Router
      await token.approve(ammRouter.address, '1000000000000000000000000000');

      if (token != wethToken) {
        // Create token pair TOKEN/WETH and supply 10 TOKENs and 1 WETH as initial liquidity.
        await ammRouter.addLiquidityETH(token.address, '10000000000000000000',
          0, 0, deployer.address, parseInt(new Date().getTime() / 1000) + 10000,
          { value: '1000000000000000000' });
      }

      // Create asset pools for crypto loan and
      await assetPool.initPool(token.address, poolConf.address);

      // set them to active (1)
      await assetPool.setPoolStatus(token.address, 1);
    }

    // Wrap 1000 ETH for User1 and User2
    await wethToken.connect(user1).deposit({ value: toWei(1000) });
    await wethToken.connect(user2).deposit({ value: toWei(1000) });
  });

  getAssetPoolShareContract = async (tokenAddress) => {
    const pool = await assetPool.pools(tokenAddress);
    let factory = await ethers.getContractFactory("AssetPoolShare");
    return factory.attach(pool.shareToken);
  };

  it("A user should own asset pool shares after deposit", async () => {
    const depositAmount = toWei(1);
    await fooToken.approve(assetPool.address, depositAmount);
    await assetPool.deposit(fooToken.address, depositAmount);
    const poolShare = await getAssetPoolShareContract(fooToken.address);
    expect(await poolShare.balanceOf(deployer.address)).to.equal(depositAmount);
  });

  it("A user can borrow asset after deposit", async () => {
    // Deployer deposit 100 FOO
    let depositAmount = toWei(100);
    await fooToken.approve(assetPool.address, depositAmount);
    await assetPool.deposit(fooToken.address, depositAmount);

    // User1 deposit 10 WETH
    depositAmount = toWei(10);
    await wethToken.connect(user1).approve(assetPool.address, depositAmount);
    await assetPool.connect(user1).deposit(wethToken.address, depositAmount);

    // User1 borrow 50 FOO (worth 5 ETH) expect success
    const borrowAmount = toWei(50);
    await assetPool.connect(user1).borrow(fooToken.address, borrowAmount);
    // Verify the borrowed share amount is 50
    const pool = await assetPool.getPool(fooToken.address);
    const userPoolData = await assetPool.getUserPoolData(user1.address, fooToken.address);

    expect(pool.totalBorrows).to.equal(borrowAmount);
    expect(pool.totalBorrowShares).to.equal(borrowAmount);
    expect(userPoolData.compoundedBorrowBalance).to.equal(borrowAmount);
    expect(userPoolData.usePoolAsCollateral).to.equal(true);

    // Cannot borrow more than max borrowable value
    await expect(assetPool.connect(user1).borrow(fooToken.address, toWei(40)))
      .to.be.revertedWith("ACCOUNT_UNHEALTHY");
  });

  it("A user can repay asset after borrow", async () => {
    // Deployer deposit 100 FOO
    let depositAmount = toWei(100);
    await fooToken.approve(assetPool.address, depositAmount);
    await assetPool.deposit(fooToken.address, depositAmount);

    // User1 deposit 10 WETH
    depositAmount = toWei(10);
    await wethToken.connect(user1).approve(assetPool.address, depositAmount);
    await assetPool.connect(user1).deposit(wethToken.address, depositAmount);

    // User1 borrow 50 FOO (worth 5 ETH) expect success
    const borrowAmount = toWei(50);
    await assetPool.connect(user1).borrow(fooToken.address, borrowAmount);
    await delay(5000);

    // User1 repay FOO token with shares
    await fooToken.connect(user1).approve(assetPool.address, (await fooToken.totalSupply()));

    // The balance is insufficient to repay because of interest grows.
    await expect(assetPool.connect(user1).repayByShare(fooToken.address, borrowAmount))
      .to.be.revertedWith("ERC20: transfer amount exceeds balance");

    // Transfer more Foo Token so user1 have sufficient balance to repay all borrowed shares
    await fooToken.transfer(user1.address, depositAmount);

    const balanceBeforeRepay = await fooToken.balanceOf(user1.address);
    // Repay successfully!
    await assetPool.connect(user1).repayByShare(fooToken.address, borrowAmount);

    const balanceAfterRepay = await fooToken.balanceOf(user1.address);
    const repayInterest = balanceBeforeRepay.sub(balanceAfterRepay).sub(borrowAmount).toNumber();

    // Verify repay interest is greater than 0
    expect(repayInterest).to.greaterThan(0);
  });

  it("A user can withdraw asset after lending", async () => {
    // Deployer deposit 100 FOO
    let depositAmount = toWei(100);
    await fooToken.approve(assetPool.address, depositAmount);
    await assetPool.deposit(fooToken.address, depositAmount);

    // User1 deposit 10 WETH
    depositAmount = toWei(10);
    await wethToken.connect(user1).approve(assetPool.address, depositAmount);
    await assetPool.connect(user1).deposit(wethToken.address, depositAmount);

    // User1 borrow 50 FOO (worth 5 ETH) expect success
    const borrowAmount = toWei(50);
    await assetPool.connect(user1).borrow(fooToken.address, borrowAmount);
    await delay(5000);

    // User1 repay FOO token with shares
    await fooToken.connect(user1).approve(assetPool.address, (await fooToken.totalSupply()));
    await fooToken.transfer(user1.address, depositAmount);
    await assetPool.connect(user1).repayByShare(fooToken.address, borrowAmount);

    // Deployer withdraw all Foo Token that has been deposited
    const balanceBeforeWithdraw = await fooToken.balanceOf(deployer.address);
    await assetPool.withdrawByShare(fooToken.address, depositAmount);
    const balanceAfterWithdraw = await fooToken.balanceOf(deployer.address);
    const withdrawInterest = balanceAfterWithdraw.sub(balanceBeforeWithdraw).sub(depositAmount).toNumber();

    // Verify repay interest is greater than 0
    expect(withdrawInterest).to.greaterThan(0);
  });
});