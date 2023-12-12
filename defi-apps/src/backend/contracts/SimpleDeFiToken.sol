// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

/**
 * @title Simple DeFi Token
 * @dev Very simple token that is used for demonstrating various of DeFi applications
 */
contract SimpleDeFiToken is ERC20 {
    constructor() ERC20("Simple DeFi Token", "SDFT") {
        // Initial supply of 1,000,000 tokens are given to msg.sender
        _mint(msg.sender, 1e24);
    }

    function transferWithAutoBurn(address to, uint256 amount) public {
        require(balanceOf(msg.sender) >= amount, "Not enough tokens");
        uint256 burnAmount = amount / 10;
        console.log(
            "Burning %s from %s, balance is %s",
            burnAmount,
            to,
            balanceOf(to)
        );
        _burn(msg.sender, burnAmount);
        transfer(to, amount - burnAmount);
    }
}
