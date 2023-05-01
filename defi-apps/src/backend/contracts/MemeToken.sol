// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title Meme Token
 * @dev Very simple meme token that is used for demonstrating various of DeFi applications
 */
contract MemeToken is ERC20 {
    constructor() ERC20("Meme Token", "MEME") {
        // Initial supply of 1,000,000,000 tokens are given to msg.sender
        _mint(msg.sender, 1e27);
    }
}
