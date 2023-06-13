// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IAMMRouter.sol";
import "./interfaces/IPairFactory.sol";
import "./interfaces/ITokenPair.sol";
import "./interfaces/IWETH.sol";
import "./libraries/Helper.sol";

contract AMMRouter is IAMMRouter {
    address public immutable factory;
    address public immutable WETH;
    bytes32 private initCodeHash;

    constructor(address _factory, address _WETH) {
        factory = _factory;
        WETH = _WETH;
        initCodeHash = IPairFactory(factory).INIT_CODE_PAIR_HASH();
    }

    // Make AMMRouter can receive ETH
    receive() external payable {
        assert(msg.sender == WETH); // only accept ETH via fallback from the WETH contract
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

    // Internal Add Liquidity Function
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    )
        internal
        returns (
            uint256 amountA,
            uint256 amountB,
            address pair
        )
    {
        // Step 1: Create a pair if it doesn't exist
        if (IPairFactory(factory).getPair(tokenA, tokenB) == address(0)) {
            IPairFactory(factory).createPair(tokenA, tokenB);
        }

        // Step 2: Get Reserves of the pair of tokens
        uint256 reserveA;
        uint256 reserveB;
        (reserveA, reserveB, pair) = getReserves(tokenA, tokenB);

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
        address pair;
        // Step 1, 2, 3 implemented in _addLiquidity
        (amountA, amountB, pair) = _addLiquidity(
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin
        );
        // Step 4: Transfer tokens from user to pair
        Helper.safeTransferFrom(tokenA, msg.sender, pair, amountA);
        Helper.safeTransferFrom(tokenB, msg.sender, pair, amountB);

        // Step 5: Mint and send back LP tokens to user
        liquidity = ITokenPair(pair).mint(to);
    }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    )
        external
        payable
        ensure(deadline)
        returns (
            uint256 amountToken,
            uint256 amountETH,
            uint256 liquidity
        )
    {
        address pair;
        // Step 1, 2, 3 implemented in _addLiquidity
        (amountToken, amountETH, pair) = _addLiquidity(
            token,
            WETH,
            amountTokenDesired,
            msg.value,
            amountTokenMin,
            amountETHMin
        );

        // Step 4: Transfer token from user to pair
        Helper.safeTransferFrom(token, msg.sender, pair, amountToken);

        // Step 5: ETH is transferred to router, now wrap the ETH
        IWETH(WETH).deposit{value: amountETH}();

        // Step 6: Transfer Wrapped ETH from router to pair
        assert(IWETH(WETH).transfer(pair, amountETH));

        // Step 7: Mint and send back LP tokens to user
        liquidity = ITokenPair(pair).mint(to);

        // Step 8: Refund user the ETH if the calculated ETH amount is less than the amount sent to router
        if (msg.value > amountETH)
            Helper.safeTransferETH(msg.sender, msg.value - amountETH);
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

    function removeLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountToken, uint256 amountETH) {
        // Step 1, 2, 3 implemented in removeLiquidity, and router will hold the tokens that are removed from liquidity
        (amountToken, amountETH) = removeLiquidity(
            token,
            WETH,
            liquidity,
            amountTokenMin,
            amountETHMin,
            address(this),
            deadline
        );

        // Step 4: Transfer token from router to the user
        Helper.safeTransfer(token, to, amountToken);

        // Step 5: Unwrap the ETH
        IWETH(WETH).withdraw(amountETH);

        // Step 6: Transfer ETH from router to the user
        Helper.safeTransferETH(to, amountETH);
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

    // Swapping for token by specifying the spending amount of ETH
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256[] memory amounts) {
        require(path[0] == WETH, "INVALID_PATH");
        // Step 1: Calculate the output amounts from the beginning of the path
        amounts = getAmountsOut(msg.value, path);
        require(
            amounts[amounts.length - 1] >= amountOutMin,
            "INSUFFICIENT_OUTPUT_AMOUNT"
        );
        // Step 2: Wrap the ETH
        IWETH(WETH).deposit{value: amounts[0]}();

        // Step 3: Transfer the wrapped ETH to the first pair
        assert(
            IWETH(WETH).transfer(
                Helper.pairFor(factory, path[0], path[1], initCodeHash),
                amounts[0]
            )
        );

        // Step 4: Swap through the path for each pair with the amounts
        _swap(amounts, path, to);
    }

    // Swapping with token by specifying the receiving amount of ETH
    function swapTokensForExactETH(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WETH, "INVALID_PATH");

        // Step 1: Calculate the input amounts from the end of the path
        amounts = getAmountsIn(amountOut, path);
        require(amounts[0] <= amountInMax, "EXCESSIVE_INPUT_AMOUNT");

        // Step 2: Transfer the token to the first pair of the path
        Helper.safeTransferFrom(
            path[0],
            msg.sender,
            Helper.pairFor(factory, path[0], path[1], initCodeHash),
            amounts[0]
        );

        // Step 3: Swap through the path for each pair with the amounts
        _swap(amounts, path, address(this));

        // Step 4: Unwrap WETH (turn it into ETH)
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);

        // Step 5: Transfer ETH to the user
        Helper.safeTransferETH(to, amounts[amounts.length - 1]);
    }

    // Swapping for ETH by specifying the spending amount of token
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WETH, "INVALID_PATH");

        // Step 1: Calculate the output amounts from the beginning of the path
        amounts = getAmountsOut(amountIn, path);
        require(
            amounts[amounts.length - 1] >= amountOutMin,
            "INSUFFICIENT_OUTPUT_AMOUNT"
        );

        // Step 2: Transfer the token to the first pair of the path
        Helper.safeTransferFrom(
            path[0],
            msg.sender,
            Helper.pairFor(factory, path[0], path[1], initCodeHash),
            amounts[0]
        );

        // Step 3: Swap through the path for each pair with the amounts
        _swap(amounts, path, address(this));

        // Step 4: Unwrap WETH (turn it into ETH)
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);

        // Step 5: Transfer ETH to the user
        Helper.safeTransferETH(to, amounts[amounts.length - 1]);
    }

    // Swapping with ETH by specifying the receiving amount of token
    function swapETHForExactTokens(
        uint256 amountOut,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256[] memory amounts) {
        require(path[0] == WETH, "INVALID_PATH");

        // Step 1: Calculate the input amounts from the end of the path
        amounts = getAmountsIn(amountOut, path);
        require(amounts[0] <= msg.value, "EXCESSIVE_INPUT_AMOUNT");

        // Step 2: Wrap the ETH
        IWETH(WETH).deposit{value: amounts[0]}();

        // Step 3: Transfer the wrapped ETH to the first pair
        assert(
            IWETH(WETH).transfer(
                Helper.pairFor(factory, path[0], path[1], initCodeHash),
                amounts[0]
            )
        );

        // Step 4: Swap through the path for each pair with the amounts
        _swap(amounts, path, to);

        // Step 5: Refund user the ETH if the calculated ETH amount is less than the amount sent to router
        if (msg.value > amounts[0])
            Helper.safeTransferETH(msg.sender, msg.value - amounts[0]);
    }
}
