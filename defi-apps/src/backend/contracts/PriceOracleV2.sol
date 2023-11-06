// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./interfaces/IAMMRouter.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/IPairFactory.sol";
import "./interfaces/ITokenPair.sol";
import "./libraries/UQ112x112.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/*
 * Price oracle based on Uniswap V2
 * Refer to https://docs.uniswap.org/contracts/v2/concepts/core-concepts/oracles
 * Strategy: simple moving average - give equal weight to each price measurement
 */
contract PriceOracleV2 is IPriceOracle {
    using UQ112x112 for uint224;
    struct Observation {
        uint256 timestamp;
        uint256 price0Cumulative;
        uint256 price1Cumulative;
    }

    address public immutable factory;

    // The desired amount of time ove which the moving average should be computed, e.g. 24 hours
    uint256 public immutable windowSize;

    // The number of observations stored for each pair,
    // The more observations, the more frequent updates are needed.
    uint8 public immutable granularity;

    // This is redundant with granularity and windowSize, but stored for gas savings & informational purposes.
    uint256 public immutable periodSize;

    // Mapping from pair address to a list of price observations of that pair
    mapping(address => Observation[]) public pairObservations;

    address public immutable WETH;

    constructor(
        address _factory,
        address _WETH,
        uint256 _windowSize,
        uint8 _granularity
    ) {
        require(_granularity > 1, "INVALID_GRANULARITY");
        require(
            (periodSize = _windowSize / _granularity) * _granularity ==
                _windowSize,
            "WINDOW_NOT_EVENLY_DIVISIBLE"
        );
        factory = _factory;
        WETH = _WETH;
        windowSize = _windowSize;
        granularity = _granularity;
    }

    // Returns the index of the observation corresponding to the given timestamp
    function observationIndexOf(uint256 timestamp)
        public
        view
        returns (uint8 index)
    {
        uint256 epochPeriod = timestamp / periodSize;
        return uint8(epochPeriod % granularity);
    }

    // Returns the observation from the oldest epoch (at the beginning of the window) relative to the current time
    function getFirstObservationInWindow(address pair)
        private
        view
        returns (Observation storage firstObservation)
    {
        uint8 observationIndex = observationIndexOf(block.timestamp);
        uint8 firstObservationIndex = (observationIndex + 1) % granularity;
        firstObservation = pairObservations[pair][firstObservationIndex];
    }

    // Produce the cumulative price to save gas and avoid a call to sync in pair
    function currentCummulativePrices(address pair)
        internal
        view
        returns (
            uint256 price0Cumulative,
            uint256 price1Cumulative,
            uint32 blockTimestamp
        )
    {
        blockTimestamp = uint32(block.timestamp % (2**32));
        price0Cumulative = ITokenPair(pair).price0CumulativeLast();
        price1Cumulative = ITokenPair(pair).price1CumulativeLast();

        // If time has elapsed since the last update on the pair, mock the accumulated price values
        (
            uint112 reserve0,
            uint112 reserve1,
            uint32 blockTimestampLast
        ) = ITokenPair(pair).getReserves();
        if (blockTimestampLast != blockTimestamp) {
            // Substraction overflow is desired
            uint32 timeElapsed = blockTimestamp - blockTimestampLast;
            price0Cumulative +=
                uint256(UQ112x112.encode(reserve1).uqdiv(reserve0)) *
                timeElapsed;
            price1Cumulative +=
                uint256(UQ112x112.encode(reserve0).uqdiv(reserve1)) *
                timeElapsed;
        }
    }

    // Update the cummulative price for the observation at the curent timestamp.
    // Each observation is updated at most once per epoch period.
    function update(address tokenA, address tokenB) external {
        address pair = IPairFactory(factory).getPair(tokenA, tokenB);

        // Populate the array with empty observations for the pair, only do at the first time
        for (uint256 i = pairObservations[pair].length; i < granularity; i++) {
            pairObservations[pair].push();
        }

        // Get the observation for the current period
        uint8 observationIndex = observationIndexOf(block.timestamp);
        Observation storage observation = pairObservations[pair][
            observationIndex
        ];

        // We only want to commit updates at most once per period
        uint256 timeElapsed = block.timestamp - observation.timestamp;
        if (timeElapsed > periodSize) {
            (
                uint256 price0Cumulative,
                uint256 price1Cumulative,

            ) = currentCummulativePrices(pair);
            observation.timestamp = block.timestamp;
            observation.price0Cumulative = price0Cumulative;
            observation.price1Cumulative = price1Cumulative;
        }
    }

    // Given the cumulative prices of the start and end of a period, and the length of the period,
    // compute the average price in terms of how much amount out is received for the amount in.
    function computeAmountOut(
        uint256 priceCumulativeStart,
        uint256 priceCumulativeEnd,
        uint256 timeElapsed,
        uint256 amountIn
    ) private pure returns (uint256) {
        return
            (((priceCumulativeEnd - priceCumulativeStart) / timeElapsed) *
                amountIn) >> 112;
    }

    function getPriceInWETH(address _token) external view returns (uint256) {
        address pair = IPairFactory(factory).getPair(_token, WETH);
        Observation storage firstObservation = getFirstObservationInWindow(
            pair
        );
        uint256 timeElapsed = block.timestamp - firstObservation.timestamp;
        require(timeElapsed <= windowSize, "MISSING_HISTORICAL_OBSERVATION");
        require(
            timeElapsed >= windowSize - periodSize * 2,
            "UNEXPECTED_TIME_ELAPSED"
        );
        (
            uint256 price0Cumulative,
            uint256 price1Cumulative,

        ) = currentCummulativePrices(pair);
        uint8 decimals = ERC20(_token).decimals();
        if (_token < WETH) {
            return
                computeAmountOut(
                    firstObservation.price0Cumulative,
                    price0Cumulative,
                    timeElapsed,
                    10**decimals
                );
        } else {
            return
                computeAmountOut(
                    firstObservation.price1Cumulative,
                    price1Cumulative,
                    timeElapsed,
                    10**decimals
                );
        }
    }
}
