// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IAssetPool.sol";

/*
 * Asset Pool Smart Contract
 * -------------------------
 * The smart contract manages multiple asset pools of a crypto loan decentralized application
 * and provides operations to deposit, withdraw, borrow, repay and liquidate for interacting with
 * these asset pools.
 */
contract LendingPool is Ownable, IAssetPool, ReentrancyGuard {
    using SafeERC20 for ERC20;

    /**
     * @dev emitted on asset pool initialization
     * @param pool the address of the ERC20 token of the pool
     * @param shareAddress the address of the pool share token
     * @param poolConfigAddress the address of the pool's configuration contract
     */
    event PoolInitialized(
        address indexed pool,
        address indexed shareAddress,
        address indexed poolConfigAddress
    );

    /**
     * @dev emitted on updating pool configuration
     * @param pool the address of the ERC20 token of the pool
     * @param poolConfigAddress the address of the updated pool's configuration contract
     */
    event PoolConfigUpdated(address indexed pool, address poolConfigAddress);

    /**
     * @dev emitted on pool updates accumulative interest
     * @param pool the address of the ERC20 token of the pool
     * @param cumulativeBorrowInterestRate the borrow interest rate which accumulated from last update timestamp to now
     * @param totalBorrows the updated total borrows of the pool. Incireasing by the acumulative borrow interest rate.
     */
    event PoolInterestUpdated(
        address indexed pool,
        uint256 cumulativeBorrowInterestRate,
        uint256 totalBorrows
    );

    /**
     * @dev emitted on deposit
     * @param pool the address of the ERC20 token of the pool
     * @param user the address of the user who deposit the ERC20 token to the pool
     * @param depositShares the asset share amount which calculated from deposit amount
     * @param depositAmount the amount of the ERC20 token that deposit to the pool
     */
    event Deposit(
        address indexed pool,
        address indexed user,
        uint256 depositShares,
        uint256 depositAmount
    );

    /**
     * @dev emitted on borrow
     * @param pool the address of the ERC20 token of the pool
     * @param user the address of the user who borrow the ERC20 token from the pool
     * @param borrowShares the amount of borrow shares which calculated from borrow amount
     * @param borrowAmount the amount of the ERC20 token that borrowed from the pool
     */
    event Borrow(
        address indexed pool,
        address indexed user,
        uint256 borrowShares,
        uint256 borrowAmount
    );

    /**
     * @dev emitted on repay
     * @param pool the address of the ERC20 token of the pool
     * @param user the address of the user who repay the ERC20 token to the pool
     * @param repayShares the amount of repay shares which calculated from repay amount
     * @param repayAmount the amount of the ERC20 token that has repaid
     */
    event Repay(
        address indexed pool,
        address indexed user,
        uint256 repayShares,
        uint256 repayAmount
    );

    /**
     * @dev emitted on withdraw shares
     * @param pool the address of the ERC20 token of the pool
     * @param user the address of the user who withdraw the ERC20 token from the pool
     * @param withdrawShares the amount of withdraw shares which calculated from withdraw amount
     * @param withdrawAmount the amount of the ERC20 token that withdrew from the pool
     */
    event Withdraw(
        address indexed pool,
        address indexed user,
        uint256 withdrawShares,
        uint256 withdrawAmount
    );

    /**
     * @dev emitted on liquidate
     * @param user the address of the user who is liquidated by liquidator
     * @param pool the address of the ERC20 token which is liquidated by liquidator
     * @param collateral the address of the ERC20 token that liquidator received as a reward
     * @param liquidateAmount the amount of the ERC20 token that liquidator liquidate for the user
     * @param liquidateShares the amount of liquidate shares which calculated from liquidate amount
     * @param collateralAmount the amount of the collateral which calculated from liquidate amount that liquidator want to liquidate
     * @param collateralShares the amount of collateral shares which liquidator received from liquidation in from of share token
     * @param liquidator the address of the liquidator
     */
    event Liquidate(
        address indexed user,
        address pool,
        address collateral,
        uint256 liquidateAmount,
        uint256 liquidateShares,
        uint256 collateralAmount,
        uint256 collateralShares,
        address liquidator
    );

    function isAccountHealthy(address _user)
        public
        view
        override
        returns (bool)
    {
        // TODO: Implement me
        return false;
    }
}
