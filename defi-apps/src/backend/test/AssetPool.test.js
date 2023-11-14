const { expect } = require("chai");
const { ethers } = require("hardhat");
const { toWei, fromWei, delay } = require("./Utils");

describe("AssetPool", () => {
  let deployer, user1, user2, pairFactory, ammRouter, fooToken, barToken, wethToken,
    shareDeployer, priceOracle, poolConf, assetPool, priceOracleV2;

  beforeEach(async () => {
    [deployer, user1, user2] = await ethers.getSigners();

    // Deploying the smart contracts
    for (const factory of ["FooToken", "BarToken", "WETH", "PairFactory", "AMMRouter",
      "AssetPoolShareDeployer", "PriceOracle", "AssetPool", "PoolConfiguration", "PriceOracleV2"]) {
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
        case "PriceOracleV2":
          priceOracleV2 = await contractFactory.deploy(pairFactory.address, wethToken.address, 720, 60);
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

    // Wrap 1000 ETH for User1
    await wethToken.connect(deployer).deposit({ value: toWei(1000) });
    await wethToken.connect(user1).deposit({ value: toWei(1000) });
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

  it("Attacker can exploit the crypto to gain profit", async () => {
    // Deployer deposit 1000 FOO
    let depositAmount = toWei(1000);
    await fooToken.approve(assetPool.address, depositAmount);
    await assetPool.deposit(fooToken.address, depositAmount);

    // Deployer deposit 100 WETH
    depositAmount = toWei(100);
    await wethToken.approve(assetPool.address, depositAmount);
    await assetPool.deposit(wethToken.address, depositAmount);

    console.log("BAR price before attack:", fromWei(await priceOracle.getPriceInWETH(barToken.address)));

    // Attacker (User2) get the balance of ETH before attack
    const ethBalanceBeforeAttack = await ethers.provider.getBalance(user2.address);

    // Attacker swaps 99 ETH for BAR token
    await ammRouter.connect(user2).swapExactETHForTokens(0,
      [wethToken.address, barToken.address], user2.address,
      parseInt(new Date().getTime() / 1000) + 10000, { value: toWei(99) });

    console.log("BAR price during attack:", fromWei(await priceOracle.getPriceInWETH(barToken.address)));

    let barBalance = await barToken.balanceOf(user2.address);

    // Attacker deposits 0.26 BAR to crypto loan asset pool
    depositAmount = toWei(0.26);
    await barToken.connect(user2).approve(assetPool.address, depositAmount);
    await assetPool.connect(user2).deposit(barToken.address, depositAmount);

    // Attacker borrows 1000 FOO
    await assetPool.connect(user2).borrow(fooToken.address, toWei(1000));

    // Attacker borrows 100 ETH
    await assetPool.connect(user2).borrow(wethToken.address, toWei(100));
    let wethBalance = await wethToken.balanceOf(user2.address);
    await wethToken.connect(user2).withdraw(wethBalance);

    // Attacker swaps 1000 FOO for ETH
    await fooToken.connect(user2).approve(ammRouter.address, toWei(1000));
    await ammRouter.connect(user2).swapExactTokensForETH(toWei(1000), 0,
      [fooToken.address, wethToken.address], user2.address,
      parseInt(new Date().getTime() / 1000) + 10000);

    // Attacker swaps remaining BAR for ETH
    barBalance = await barToken.balanceOf(user2.address);
    await barToken.connect(user2).approve(ammRouter.address, barBalance);
    await ammRouter.connect(user2).swapExactTokensForETH(barBalance, 0,
      [barToken.address, wethToken.address], user2.address,
      parseInt(new Date().getTime() / 1000) + 10000);

    console.log("BAR price after attack:", fromWei(await priceOracle.getPriceInWETH(barToken.address)));

    // Get the ETH balance of attacker, expect to make profit
    const ethBalanceAfterAttack = await ethers.provider.getBalance(user2.address);
    expect(ethBalanceAfterAttack).to.greaterThan(ethBalanceBeforeAttack);

    console.log("Attacker's profit in ETH",
      fromWei(ethBalanceAfterAttack.sub(ethBalanceBeforeAttack)))
  });

  it("Attacker cannot gain profit with the price oracle v2", async () => {
    // Use v2 as the price oracle
    await assetPool.setPriceOracle(priceOracleV2.address);

    // Deployer deposit 1000 FOO
    let depositAmount = toWei(1000);
    await fooToken.approve(assetPool.address, depositAmount);
    await assetPool.deposit(fooToken.address, depositAmount);

    // User1 deposit 100 WETH
    depositAmount = toWei(100);
    await wethToken.approve(assetPool.address, depositAmount);
    await assetPool.deposit(wethToken.address, depositAmount);

    // Attacker (User2) get the balance of ETH before attack
    const ethBalanceBeforeAttack = await ethers.provider.getBalance(user2.address);
    await barToken.connect(user2).approve(assetPool.address, depositAmount);
    await priceOracleV2.update(fooToken.address, wethToken.address);
    await priceOracleV2.update(barToken.address, wethToken.address);
    // Before attacking, there are some swapping transactions for BAR
    let barPrice;
    await barToken.approve(ammRouter.address, await barToken.balanceOf(deployer.address));
    for (let i = 0; i < 480; i++) {
      // Randomly swap ETH to BAR and BAR to ETH
      if (i % 2 == 0) {
        await ammRouter.swapExactETHForTokens(0,
          [wethToken.address, barToken.address], deployer.address,
          parseInt(new Date().getTime() / 1000) + 10000, { value: toWei(0.01 + Math.random()) })
      } else {
        await ammRouter.swapExactTokensForETH(toWei(0.1 + 10 * Math.random()), 0,
          [barToken.address, wethToken.address], deployer.address,
          parseInt(new Date().getTime() / 1000) + 10000);
      }
      // Update prices for FOO and BAR tokens
      await priceOracleV2.update(fooToken.address, wethToken.address);
      await priceOracleV2.update(barToken.address, wethToken.address);
    }
    barPrice = await priceOracleV2.getPriceInWETH(barToken.address);
    barPrice = await priceOracle.getPriceInWETH(barToken.address);

    // Attacker swaps 99 ETH for BAR token
    await ammRouter.connect(user2).swapExactETHForTokens(0,
      [wethToken.address, barToken.address], user2.address,
      parseInt(new Date().getTime() / 1000) + 10000, { value: toWei(99) });
    await priceOracleV2.update(fooToken.address, wethToken.address);
    await priceOracleV2.update(barToken.address, wethToken.address);
    let barBalance = await barToken.balanceOf(user2.address);
    barPrice = await priceOracleV2.getPriceInWETH(barToken.address);
    console.log("Price of BAR after manipulate (Oracle v2)", fromWei(barPrice));
    barPrice = await priceOracle.getPriceInWETH(barToken.address);
    console.log("Price of BAR (Oracle v1)", fromWei(barPrice));

    // Attacker deposits all BAR to crypto loan asset pool
    depositAmount = barBalance;
    await assetPool.connect(user2).deposit(barToken.address, depositAmount);

    barPrice = await priceOracleV2.getPriceInWETH(barToken.address);
    // Attacker borrows 99 WETH which is spent for manipulate the price
    await expect(assetPool.connect(user2).borrow(wethToken.address, toWei(99)))
      .to.be.revertedWith("ACCOUNT_UNHEALTHY");
  });
});