// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract StakingPool is Ownable, ReentrancyGuard {
    using SafeERC20 for ERC20;

    // Accrued token per share;
    uint256 public accTokenPerShare;

    // The block number when reward starts
    uint256 public rewardStartBlock;

    // The block number when reward ends
    uint256 public rewardEndBlock;

    // The block number of the last update for the pool
    uint256 public lastRewardBlock;

    // Token reward per block
    uint256 public rewardPerBlock;

    // The precision factor
    uint256 public immutable PRECISION_FACTOR;

    // The reward token
    ERC20 public rewardToken;

    // The staked token
    ERC20 public stakedToken;

    // The total amount of staked token, aka. share amount
    uint256 public stakedTokenSupply;

    // User info for staked tokens and reward debt
    mapping(address => UserInfo) public userInfo;
    struct UserInfo {
        uint256 amount; // How many token staked
        uint256 rewardDebt; // Reward debt
    }

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event UpdateStartAndEndBlocks(uint256 startBlock, uint256 endBlock);
    event UpdateRewardPerBlock(uint256 rewardPerBlock);
    event StopRewards(uint256 blockNumber);
    event RecoverToken(address tokenRecovered, uint256 amount);

    constructor(
        ERC20 _stakedToken,
        ERC20 _rewardToken,
        uint256 _rewardPerBlock,
        uint256 _rewardStartBlock,
        uint256 _rewardEndBlock
    ) {
        stakedToken = _stakedToken;
        rewardToken = _rewardToken;
        rewardPerBlock = _rewardPerBlock;
        rewardStartBlock = _rewardStartBlock;
        rewardEndBlock = _rewardEndBlock;

        // Decimals of reward token
        uint256 decimalsRewardToken = rewardToken.decimals();
        require(
            decimalsRewardToken < 30,
            "Decimals of reward token must be less than 30"
        );
        PRECISION_FACTOR = 10**(30 - decimalsRewardToken);

        // Set the last reward block as the start block
        lastRewardBlock = rewardStartBlock;
    }

    /*
     * Deposit staked token and collect reward tokens (if any)
     */
    function deposit(uint256 _amount) external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];

        _updatePool();
        if (user.amount > 0) {
            uint256 pendingReward = (user.amount * accTokenPerShare) /
                PRECISION_FACTOR -
                user.rewardDebt;
            if (pendingReward > 0) {
                rewardToken.safeTransfer(address(msg.sender), pendingReward);
            }
        }
        if (_amount > 0) {
            user.amount += _amount;
            stakedTokenSupply += _amount;
            stakedToken.safeTransferFrom(
                address(msg.sender),
                address(this),
                _amount
            );
        }
        user.rewardDebt = (user.amount * accTokenPerShare) / PRECISION_FACTOR;

        emit Deposit(msg.sender, _amount);
    }

    /*
     * Withdraw staked tokens and collect reward tokens
     */
    function withdraw(uint256 _amount) external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "Insufficient amount to withdraw");
        _updatePool();
        uint256 pendingReward = (user.amount * accTokenPerShare) /
            PRECISION_FACTOR -
            user.rewardDebt;
        if (_amount > 0) {
            user.amount -= _amount;
            stakedTokenSupply -= _amount;
            stakedToken.safeTransfer(address(msg.sender), _amount);
        }
        if (pendingReward > 0) {
            rewardToken.safeTransfer(address(msg.sender), pendingReward);
        }
        user.rewardDebt = (user.amount * accTokenPerShare) / PRECISION_FACTOR;

        emit Withdraw(msg.sender, _amount);
    }

    /*
     * The function allows owner to recover wrong tokens sent to the contract
     */
    function recoverWrongTokens(address _tokenAddress, uint256 _tokenAmount)
        external
        onlyOwner
    {
        require(
            _tokenAddress != address(stakedToken),
            "Cannot be staked token"
        );
        require(
            _tokenAddress != address(rewardToken),
            "Cannot be reward token"
        );
        ERC20(_tokenAddress).safeTransfer(address(msg.sender), _tokenAmount);
        emit RecoverToken(_tokenAddress, _tokenAmount);
    }

    /*
     * Stop rewards, only callable by owner
     */
    function stopRewards() external onlyOwner {
        rewardEndBlock = block.number;
        emit StopRewards(rewardEndBlock);
    }

    /*
     * Update reward per block, only callable by owner
     */
    function updateRewardPerBlock(uint256 _rewardPerBlock) external onlyOwner {
        require(block.number < rewardStartBlock, "Pool has started");
        rewardPerBlock = _rewardPerBlock;
        emit UpdateRewardPerBlock(_rewardPerBlock);
    }

    /*
     * Update the reward start block and reward end block, only callable by owner
     */
    function updateStartAndEndBlocks(
        uint256 _rewardStartBlock,
        uint256 _rewardEndBlock
    ) external onlyOwner {
        require(block.number < rewardStartBlock, "Pool has started");
        require(
            _rewardStartBlock < _rewardEndBlock,
            "New start block must be lower than new end block"
        );
        require(
            block.number < _rewardStartBlock,
            "New start block must be higher than current block"
        );
        rewardStartBlock = _rewardStartBlock;
        rewardEndBlock = _rewardEndBlock;

        // Set the lastRewardBlock as the new start block
        lastRewardBlock = rewardStartBlock;

        emit UpdateStartAndEndBlocks(_rewardStartBlock, _rewardEndBlock);
    }

    /*
     * Return number of blocks for reward (the multiplier) over the given _from and _to block number
     */
    function _getMultiplier(uint256 _from, uint256 _to)
        internal
        view
        returns (uint256)
    {
        if (_to <= rewardEndBlock) {
            return _to - _from;
        } else if (_from >= rewardEndBlock) {
            return 0;
        } else {
            return rewardEndBlock - _from;
        }
    }

    /*
     * Update accTokenPerShare and lastRewardBlock
     */
    function _updatePool() internal {
        if (block.number <= lastRewardBlock) {
            return;
        }

        if (stakedTokenSupply == 0) {
            lastRewardBlock = block.number;
            return;
        }

        uint256 reward = rewardPerBlock *
            _getMultiplier(lastRewardBlock, block.number);
        accTokenPerShare += (reward * PRECISION_FACTOR) / stakedTokenSupply;
        lastRewardBlock = block.number;
    }

    /*
     * Get the pending reward of a user, this function is called by frontend
     */
    function getPendingReward(address _user) external view returns (uint256) {
        UserInfo storage user = userInfo[_user];
        if (block.number > lastRewardBlock && stakedTokenSupply != 0) {
            uint256 reward = rewardPerBlock *
                _getMultiplier(lastRewardBlock, block.number);
            uint256 adjustedTokenPerShare = accTokenPerShare +
                (reward * PRECISION_FACTOR) /
                stakedTokenSupply;
            return
                (user.amount * adjustedTokenPerShare) /
                PRECISION_FACTOR -
                user.rewardDebt;
        } else {
            return
                (user.amount * accTokenPerShare) /
                PRECISION_FACTOR -
                user.rewardDebt;
        }
    }
}
