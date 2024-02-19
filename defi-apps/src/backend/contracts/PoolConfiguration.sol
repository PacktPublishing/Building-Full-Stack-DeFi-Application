// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Asset Pool Configuration Smart Contract
contract PoolConfiguration {
    // Base borrowing interest rate
    uint256 public baseBorrowRate;

    // Optimal utilization rate span
    uint256 public optimalSpan;

    // Excess utilization span
    uint256 public excessSpan;

    // Optimal utilization rate
    uint256 public optimalUtilizationRate;

    // Collateral rate: rate of collateral in the asset pool can be used as loan value
    uint256 public collateralRate;

    // Liqudation bonus rate
    uint256 public liquidationBonusRate;

    constructor(
        uint256 _baseBorrowRate,
        uint256 _optimalSpan,
        uint256 _exceessSpan,
        uint256 _optimalUtilizationRate,
        uint256 _collateralRate,
        uint256 _liquidationBonusRate
    ) {
        require(
            _optimalUtilizationRate < 1e18,
            "INVALID_OPTIMAL_UTILIZIATION_RATE"
        );
        baseBorrowRate = _baseBorrowRate;
        optimalSpan = _optimalSpan;
        excessSpan = _exceessSpan;
        optimalUtilizationRate = _optimalUtilizationRate;
        collateralRate = _collateralRate;
        liquidationBonusRate = _liquidationBonusRate;
    }

    function getUtilizationRate(uint256 _totalBorrows, uint256 _totalLiquidity)
        public
        pure
        returns (uint256)
    {
        return
            _totalLiquidity == 0 ? 0 : (_totalBorrows * 1e18) / _totalLiquidity;
    }

    function calculateBorrowInterestRate(
        uint256 _totalBorrows,
        uint256 _totalLiquidity
    ) public view returns (uint256) {
        uint256 utilizationRate = getUtilizationRate(
            _totalBorrows,
            _totalLiquidity
        );
        if (utilizationRate > optimalUtilizationRate) {
            return
                baseBorrowRate +
                optimalSpan +
                (excessSpan * (utilizationRate - optimalUtilizationRate)) /
                (1e18 - optimalUtilizationRate);
        } else {
            return
                baseBorrowRate +
                (utilizationRate * optimalSpan) /
                optimalUtilizationRate;
        }
    }
}
