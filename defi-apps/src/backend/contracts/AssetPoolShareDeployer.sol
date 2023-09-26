// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IAssetPool.sol";
import "./AssetPoolShare.sol";

// Deploy the share token for asset pools
contract AssetPoolShareDeployer {
    function createAssetPoolShare(
        string memory _name,
        string memory _symbol,
        ERC20 _underlyingAsset
    ) public returns (AssetPoolShare) {
        AssetPoolShare shareToken = new AssetPoolShare(
            _name,
            _symbol,
            IAssetPool(msg.sender),
            _underlyingAsset
        );
        shareToken.transferOwnership(msg.sender);
        return shareToken;
    }
}
