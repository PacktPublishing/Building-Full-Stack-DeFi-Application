// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IAssetPool {
    /**
     * Return if an account is healthy or not
     */
    function isAccountHealthy(address _account) external view returns (bool);
}
