// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IAMMRouter.sol";
import "./interfaces/IPairFactory.sol";
import "./interfaces/ITokenPair.sol";
import "./libraries/Helper.sol";

contract AMMRouter is IAMMRouter {
    address public immutable factory;
    bytes32 private initCodeHash;

    constructor(address _factory) {
        factory = _factory;
        initCodeHash = IPairFactory(factory).INIT_CODE_PAIR_HASH();
    }

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "EXPIRED");
        _;
    }

    // Fetch the reserves and pair address for a pair while respecting the token order
    function getReserves(address tokenA, address tokenB)
        public
        view
        returns (
            uint256 reserveA,
            uint256 reserveB,
            address pair
        )
    {
        (address _tokenA, ) = Helper.sortTokens(tokenA, tokenB);
        pair = Helper.pairFor(factory, tokenA, tokenB, initCodeHash);
        (uint256 _reserveA, uint256 _reserveB, ) = ITokenPair(pair)
            .getReserves();
        (reserveA, reserveB) = tokenA == _tokenA
            ? (_reserveA, _reserveB)
            : (_reserveB, _reserveA);
    }

    // Perform getAmountOut calculation along the pairs in the path
    function getAmountsOut(uint256 amountIn, address[] memory path)
        public
        view
        returns (uint256[] memory amounts)
    {
        require(path.length >= 2, "INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i; i < path.length - 1; i++) {
            (uint256 reserveIn, uint256 reserveOut, ) = getReserves(
                path[i],
                path[i + 1]
            );
            amounts[i + 1] = Helper.getAmountOut(
                amounts[i],
                reserveIn,
                reserveOut
            );
        }
    }

    // Perform getAmountIn calculation from the pair in the end of the path
    function getAmountsIn(uint256 amountOut, address[] memory path)
        public
        view
        returns (uint256[] memory amounts)
    {
        require(path.length >= 2, "INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[amounts.length - 1] = amountOut;
        for (uint256 i = path.length - 1; i > 0; i--) {
            (uint256 reserveIn, uint256 reserveOut, ) = getReserves(
                path[i - 1],
                path[i]
            );
            amounts[i - 1] = Helper.getAmountIn(
                amounts[i],
                reserveIn,
                reserveOut
            );
        }
    }

    // Add Liquidity
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        ensure(deadline)
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        )
    {
        // Step 1: Create a pair if it doesn't exist
        if (IPairFactory(factory).getPair(tokenA, tokenB) == address(0)) {
            IPairFactory(factory).createPair(tokenA, tokenB);
        }

        // Step 2: Get Reserves of the pair of tokens
        (uint256 reserveA, uint256 reserveB, address pair) = getReserves(
            tokenA,
            tokenB
        );

        // Step 3: Calculate the actual amounts of tokens for liquidity
        if (reserveA == 0 && reserveB == 0) {
            // No liquidity yet
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            // Liquidity already exists
            uint256 amountBOptimal = Helper.quote(
                amountADesired,
                reserveA,
                reserveB
            );
            if (amountBOptimal <= amountBDesired) {
                require(
                    amountBOptimal >= amountBMin,
                    "INSUFFICIENT_tokenB_AMOUNT"
                );
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = Helper.quote(
                    amountBDesired,
                    reserveB,
                    reserveA
                );
                assert(amountAOptimal <= amountADesired);
                require(
                    amountAOptimal >= amountAMin,
                    "INSUFFICIENT_tokenA_AMOUNT"
                );
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
        // Step 4: Transfer tokens from user to pair
        Helper.safeTransferFrom(tokenA, msg.sender, pair, amountA);
        Helper.safeTransferFrom(tokenB, msg.sender, pair, amountB);

        // Step 5: Mint and send back LP tokens to user
        liquidity = ITokenPair(pair).mint(to);
    }

    // Remove Liquidity
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        // Step 1: Tranfer LP tokens to pair
        address pair = Helper.pairFor(factory, tokenA, tokenB, initCodeHash);
        Helper.safeTransferFrom(pair, msg.sender, pair, liquidity);

        // Step 2: Burn LP tokens and transfer removed liquidity back to user
        (uint256 amount0, uint256 amount1) = ITokenPair(pair).burn(to);

        // Step 3: Verify the amounts of the liquidity are sufficient
        (address _tokenA, ) = Helper.sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == _tokenA
            ? (amount0, amount1)
            : (amount1, amount0);
        require(amountA >= amountAMin, "INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "INSUFFICIENT_B_AMOUNT");
    }

    // Internal function for swapping tokens along the specified path in a loop
    // requires the initial amount to have already been sent to the first pair
    function _swap(
        uint256[] memory amounts,
        address[] memory path,
        address _to
    ) internal virtual {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address tokenA, ) = Helper.sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];
            (uint256 amountAOut, uint256 amountBOut) = input == tokenA
                ? (uint256(0), amountOut)
                : (amountOut, uint256(0));
            address to = i < path.length - 2
                ? Helper.pairFor(factory, output, path[i + 2], initCodeHash)
                : _to;
            ITokenPair(Helper.pairFor(factory, input, output, initCodeHash))
                .swap(amountAOut, amountBOut, to);
        }
    }

    // Swapping by specifying spending amount
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        // Step 1: Calculate the amounts to be swapped out along the path
        amounts = getAmountsOut(amountIn, path);
        require(
            amounts[amounts.length - 1] >= amountOutMin,
            "INSUFFICIENT_OUTPUT_AMOUNT"
        );

        // Step 2: Transfer to the first pair in the path
        Helper.safeTransferFrom(
            path[0],
            msg.sender,
            Helper.pairFor(factory, path[0], path[1], initCodeHash),
            amounts[0]
        );

        // Step 3: Swap through the path for each pair with the amounts
        _swap(amounts, path, to);
    }

    // Swapping by specifying the receiving amount
    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        // Step 1: Calculate the input amounts from the end of the path
        amounts = getAmountsIn(amountOut, path);
        require(amounts[0] <= amountInMax, "EXCESSIVE_INPUT_AMOUNT");

        // Step 2: Transfer to the first pair in the path
        Helper.safeTransferFrom(
            path[0],
            msg.sender,
            Helper.pairFor(factory, path[0], path[1], initCodeHash),
            amounts[0]
        );

        // Step 3: Swap through the path for each pair with the amounts
        _swap(amounts, path, to);
    }
}
