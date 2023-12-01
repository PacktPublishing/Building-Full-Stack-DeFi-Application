// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IAssetPool.sol";

// The token to represnet the share of asset pools
contract AssetPoolShare is ERC20, Ownable {
    IAssetPool private assetPool;
    ERC20 public underlyingAsset;

    constructor(
        string memory _name,
        string memory _symbol,
        IAssetPool _assetPool,
        ERC20 _underlyingAsset
    ) ERC20(_name, _symbol) {
        assetPool = _assetPool;
        underlyingAsset = _underlyingAsset;
    }

    // Mint the share to the account with the amount
    function mint(address _account, uint256 _amount) external onlyOwner {
        _mint(_account, _amount);
    }

    // Burn the share from the address with the amount
    function burn(address _account, uint256 _amount) external onlyOwner {
        _burn(_account, _amount);
    }

    // The asset pool will check if the account is healthy after transferring, only healthy account can transfer out.
    function _transfer(
        address _from,
        address _to,
        uint256 _amount
    ) internal override {
        super._transfer(_from, _to, _amount);
        require(assetPool.isAccountHealthy(_from), "TRANSFER_NOT_ALLOWED");
    }
}
