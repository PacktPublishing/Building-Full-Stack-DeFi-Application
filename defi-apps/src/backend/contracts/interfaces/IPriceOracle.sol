// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPriceOracle {
    function WETH() external view returns (address);

    function getPriceInWETH(address token) external view returns (uint256);
}
