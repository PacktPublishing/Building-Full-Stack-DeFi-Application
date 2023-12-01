// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./StakingPool.sol";

// Smart contract to deploy staking pools and maintain a list of staking pool
contract StakingPoolManager {
    address[] public stakingPools;

    event CreateStakingPool(address owner, address stakingPool);

    /*
     * Deploy a new staking pool
     */
    function createStakingPool(
        ERC20 _stakedToken,
        ERC20 _rewardToken,
        uint256 _rewardPerBlock,
        uint256 _rewardStartBlock,
        uint256 _rewardEndBlock
    ) public returns (StakingPool) {
        StakingPool stakingPool = new StakingPool(
            _stakedToken,
            _rewardToken,
            _rewardPerBlock,
            _rewardStartBlock,
            _rewardEndBlock
        );
        stakingPool.transferOwnership(msg.sender);
        stakingPools.push(address(stakingPool));
        emit CreateStakingPool(msg.sender, address(stakingPool));
        return stakingPool;
    }

    /*
     * Get the address of all staking pools
     */
    function getAllStakingPools() public view returns (address[] memory) {
        return stakingPools;
    }
}
