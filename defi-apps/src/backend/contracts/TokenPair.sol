// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/ITokenPair.sol";
import "./interfaces/IPairFactory.sol";
import "./libraries/UQ112x112.sol";

contract TokenPair is ITokenPair, ERC20, ReentrancyGuard {
    using UQ112x112 for uint224;
    bytes4 private constant SELECTOR =
        bytes4(keccak256(bytes("transfer(address,uint256)")));

    address public factory;
    address public tokenA;
    address public tokenB;
    uint256 public kLast;
    uint256 public constant MINIMUM_LIQUIDITY = 10**3;

    uint112 private reserveA; // The reserve amount of tokenA
    uint112 private reserveB; // The reserve amount of tokenB
    uint32 private blockTimestampLast; // The timestamp of the last change for the reserves.

    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;

    function getReserves()
        public
        view
        returns (
            uint112 _reserveA,
            uint112 _reserveB,
            uint32 _blockTimestampLast
        )
    {
        _reserveA = reserveA;
        _reserveB = reserveB;
        _blockTimestampLast = blockTimestampLast;
    }

    function _safeTransfer(
        address token,
        address to,
        uint256 value
    ) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(SELECTOR, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "TRANSFER_FAILED"
        );
    }

    constructor() ERC20("DEX Token Pair", "DEX-TP") {
        factory = msg.sender;
    }

    function initialize(address _tokenA, address _tokenB) external {
        require(msg.sender == factory, "NOT_FACTORY");
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    function _update(
        uint256 balanceA,
        uint256 balanceB,
        uint112 _reserveA,
        uint112 _reserveB
    ) private {
        require(
            balanceA <= type(uint112).max && balanceB <= type(uint112).max,
            "OVERFLOW"
        );
        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        // overflow is desired
        // expecting less than 2^32 seconds (~136 years) between 2 updates
        uint32 timeElapsed = blockTimestamp - blockTimestampLast;
        if (timeElapsed > 0 && _reserveA != 0 && _reserveB != 0) {
            // * never overflows, and + overflow is desired
            price0CumulativeLast +=
                uint256(UQ112x112.encode(_reserveB).uqdiv(_reserveA)) *
                timeElapsed;
            price1CumulativeLast +=
                uint256(UQ112x112.encode(_reserveA).uqdiv(_reserveB)) *
                timeElapsed;
        }

        reserveA = uint112(balanceA);
        reserveB = uint112(balanceB);
        blockTimestampLast = blockTimestamp;
        emit Sync(reserveA, reserveB);
    }

    // Mint reward for DEX owner
    function _mintReward(uint256 _reserveA, uint256 _reserveB)
        private
        returns (bool hasReward)
    {
        address rewardTo = IPairFactory(factory).rewardTo();
        hasReward = rewardTo != address(0);
        uint256 _kLast = kLast; // gas savings
        if (hasReward) {
            if (_kLast != 0) {
                uint256 rootK = Math.sqrt(_reserveA * _reserveB);
                uint256 rootKLast = Math.sqrt(_kLast);
                if (rootK > rootKLast) {
                    uint256 liquidity = (totalSupply() * (rootK - rootKLast)) /
                        (rootKLast + rootK * 9);
                    if (liquidity > 0) _mint(rewardTo, liquidity);
                }
            }
        } else if (_kLast != 0) {
            kLast = 0;
        }
    }

    function mint(address to)
        external
        nonReentrant
        returns (uint256 liquidity)
    {
        // Step 1: Calculate amounts of LP Tokens to be minted
        (uint112 _reserveA, uint112 _reserveB, ) = getReserves();
        uint256 balanceA = IERC20(tokenA).balanceOf(address(this));
        uint256 balanceB = IERC20(tokenB).balanceOf(address(this));
        uint256 amountA = balanceA - _reserveA;
        uint256 amountB = balanceB - _reserveB;

        bool hasReward = _mintReward(_reserveA, _reserveB);
        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            liquidity = Math.sqrt(amountA * amountB) - MINIMUM_LIQUIDITY;
            _mint(address(0xdEaD), MINIMUM_LIQUIDITY); // permanently lock the first MINIMUM_LIQUIDITY tokens to prevent somebody drain all LP tokens.
        } else {
            liquidity = Math.min(
                (amountA * _totalSupply) / _reserveA,
                (amountB * _totalSupply) / _reserveB
            );
        }
        require(liquidity > 0, "INSUFFICIENT_LIQUIDITY_MINTED");

        // Step 2: Mint the LP tokens and send to user
        _mint(to, liquidity);

        // Step 3: Update the reserves
        _update(balanceA, balanceB, _reserveA, _reserveB);

        if (hasReward) kLast = uint256(reserveA) * uint256(reserveB);
        emit Mint(msg.sender, amountA, amountB);
    }

    function burn(address to)
        external
        nonReentrant
        returns (uint256 amountA, uint256 amountB)
    {
        // Step 1: Calculate token amounts sent back to user
        (uint112 _reserveA, uint112 _reserveB, ) = getReserves();
        address _tokenA = tokenA;
        address _tokenB = tokenB;
        uint256 balanceA = IERC20(_tokenA).balanceOf(address(this));
        uint256 balanceB = IERC20(_tokenB).balanceOf(address(this));
        uint256 liquidity = balanceOf(address(this));

        bool hasReward = _mintReward(_reserveA, _reserveB);
        uint256 _totalSupply = totalSupply();
        amountA = (liquidity * balanceA) / _totalSupply;
        amountB = (liquidity * balanceB) / _totalSupply;
        require(amountA > 0 && amountB > 0, "INSUFFICIENT_BURNING_LIQUIDITY");

        // Step 2: Burn the LP tokens and send paired tokens
        _burn(address(this), liquidity);
        _safeTransfer(_tokenA, to, amountA);
        _safeTransfer(_tokenB, to, amountB);

        // Step 3: Set the reserves with token balances
        balanceA = IERC20(_tokenA).balanceOf(address(this));
        balanceB = IERC20(_tokenB).balanceOf(address(this));
        _update(balanceA, balanceB, _reserveA, _reserveB);
        if (hasReward) kLast = uint256(reserveA) * uint256(reserveB);
        emit Burn(msg.sender, amountA, amountB, to);
    }

    function swap(
        uint256 amountAOut,
        uint256 amountBOut,
        address to
    ) external nonReentrant {
        // Step 1: Pre-transfer verification
        require(amountAOut > 0 || amountBOut > 0, "INVALID_OUTPUT_AMOUNT");
        (uint112 _reserveA, uint112 _reserveB, ) = getReserves();
        require(
            amountAOut < _reserveA && amountBOut < _reserveB,
            "INSUFFICIENT_RESERVE"
        );
        address _tokenA = tokenA;
        address _tokenB = tokenB;
        require(to != _tokenA && to != _tokenB, "INVALID_OUTPUT_ADDRESS");
        // Step 2: Perform the transfer
        if (amountAOut > 0) _safeTransfer(_tokenA, to, amountAOut);
        if (amountBOut > 0) _safeTransfer(_tokenB, to, amountBOut);

        // Step 3: Verify if the input amount is sufficient
        uint256 balanceA = IERC20(_tokenA).balanceOf(address(this));
        uint256 balanceB = IERC20(_tokenB).balanceOf(address(this));
        uint256 amountAIn = balanceA > _reserveA - amountAOut
            ? balanceA - (_reserveA - amountAOut)
            : 0;
        uint256 amountBIn = balanceB > _reserveB - amountBOut
            ? balanceB - (_reserveB - amountBOut)
            : 0;
        require(amountAIn > 0 || amountBIn > 0, "INSUFFICIENT_INPUT_AMOUNT");

        // Step 4: Verify if the balances are sufficient for rewards
        {
            // Scope for balance{0,1}Adjusted, avoids stack to deep error.
            uint256 balanceAAdjusted = balanceA * 1000 - amountAIn * 2;
            uint256 balanceBAdjusted = balanceB * 1000 - amountBIn * 2;
            require(
                balanceAAdjusted * balanceBAdjusted >=
                    uint256(reserveA) * uint256(reserveB) * 1000**2,
                "INSUFFICIENT_LIQUIDITY"
            );
        }

        // Step 5: Update the reserves with token balances
        _update(balanceA, balanceB, reserveA, reserveB);
        emit Swap(msg.sender, amountAIn, amountBIn, amountAOut, amountBOut, to);
    }

    // Force balances to match reserves
    function skim(address to) external nonReentrant {
        address _tokenA = tokenA;
        address _tokenB = tokenB;
        _safeTransfer(
            _tokenA,
            to,
            IERC20(_tokenA).balanceOf(address(this)) - reserveA
        );
        _safeTransfer(
            _tokenB,
            to,
            IERC20(_tokenB).balanceOf(address(this)) - reserveB
        );
    }

    // Force reserves to match balances
    function sync() external nonReentrant {
        _update(
            IERC20(tokenA).balanceOf(address(this)),
            IERC20(tokenB).balanceOf(address(this)),
            reserveA,
            reserveB
        );
    }
}
