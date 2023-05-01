// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITokenPair {
    event Mint(address indexed sender, uint256 amountA, uint256 amountB);
    event Burn(
        address indexed sender,
        uint256 amountA,
        uint256 amountB,
        address indexed to
    );
    event Swap(
        address indexed sender,
        uint256 amountAIn,
        uint256 amountBIn,
        uint256 amountAOut,
        uint256 amountBOut,
        address indexed to
    );
    event Sync(uint256 reserveA, uint256 reserveB);

    function factory() external view returns (address);

    function tokenA() external view returns (address);

    function tokenB() external view returns (address);

    function kLast() external view returns (uint256);

    function getReserves()
        external
        view
        returns (
            uint256 reserveA,
            uint256 reserveB,
            uint256 blockTimestampLast
        );

    function mint(address to) external returns (uint256 liquidity);

    function burn(address to)
        external
        returns (uint256 amountA, uint256 amountB);

    function swap(
        uint256 amountAOut,
        uint256 amountBOut,
        address to
    ) external;

    function skim(address to) external;

    function sync() external;

    function initialize(address, address) external;
}
