// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./interfaces/IAMMRouter.sol";
import "./interfaces/IPriceOracle.sol";
import "./libraries/Helper.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/*
 * The simple version of price oracle based on DEX
 * NOTE: It's extreme insecure to use this smart contract, we will improve it in Chapter 13.
 */
contract PriceOracle is IPriceOracle {
    address public router;
    address public WETH;

    constructor(address _router, address _WETH) {
        router = _router;
        WETH = _WETH;
    }

    function getPriceInWETH(address _token) external view returns (uint256) {
        (uint256 reserveToken, uint256 reserveWETH, ) = IAMMRouter(router)
            .getReserves(_token, WETH);
        if (reserveToken == 0) {
            // No reserve for the token in TOKEN/ETH
            return 0;
        }
        uint256 decimal = ERC20(_token).decimals();
        return (10**decimal * reserveWETH) / reserveToken;
    }
}
