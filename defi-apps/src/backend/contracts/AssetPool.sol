// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IAssetPool.sol";
import "./interfaces/IPriceOracle.sol";
import "./PoolConfiguration.sol";
import "./AssetPoolShare.sol";
import "./AssetPoolShareDeployer.sol";

/*
 * Asset Pool Smart Contract
 * -------------------------
 * The smart contract manages multiple asset pools of a crypto loan decentralized application
 * and provides operations to deposit, withdraw, borrow, repay and liquidate for interacting with
 * these asset pools.
 */
contract AssetPool is Ownable, IAssetPool, ReentrancyGuard {
    using SafeERC20 for ERC20;

    /**
     * @dev emitted on asset pool initialization
     * @param token the address of the ERC20 token of the pool
     * @param shareAddress the address of the pool share token
     * @param poolConfigAddress the address of the pool's configuration contract
     */
    event PoolInitialized(
        address indexed token,
        address indexed shareAddress,
        address indexed poolConfigAddress
    );

    /**
     * @dev emitted on updating pool configuration
     * @param token the address of the ERC20 token of the pool
     * @param poolConfigAddress the address of the updated pool's configuration contract
     */
    event PoolConfigUpdated(address indexed token, address poolConfigAddress);

    /**
     * @dev emitted on pool updates accumulative interest
     * @param token the address of the ERC20 token of the pool
     * @param cumulativeBorrowInterestRate the borrow interest rate which accumulated from last update timestamp to now
     * @param totalBorrows the updated total borrows of the pool. Incireasing by the acumulative borrow interest rate.
     */
    event PoolInterestUpdated(
        address indexed token,
        uint256 cumulativeBorrowInterestRate,
        uint256 totalBorrows
    );

    /**
     * @dev emitted on deposit
     * @param pool the address of the ERC20 token of the pool
     * @param user the address of the user who deposit the ERC20 token to the pool
     * @param depositShares the asset share amount which calculated from deposit amount
     * @param depositAmount the amount of the ERC20 token that deposit to the pool
     */
    event Deposit(
        address indexed pool,
        address indexed user,
        uint256 depositShares,
        uint256 depositAmount
    );

    /**
     * @dev emitted on borrow
     * @param pool the address of the ERC20 token of the pool
     * @param user the address of the user who borrow the ERC20 token from the pool
     * @param borrowShares the amount of borrow shares which calculated from borrow amount
     * @param borrowAmount the amount of the ERC20 token that borrowed from the pool
     */
    event Borrow(
        address indexed pool,
        address indexed user,
        uint256 borrowShares,
        uint256 borrowAmount
    );

    /**
     * @dev emitted on repay
     * @param pool the address of the ERC20 token of the pool
     * @param user the address of the user who repay the ERC20 token to the pool
     * @param repayShares the amount of repay shares which calculated from repay amount
     * @param repayAmount the amount of the ERC20 token that has repaid
     */
    event Repay(
        address indexed pool,
        address indexed user,
        uint256 repayShares,
        uint256 repayAmount
    );

    /**
     * @dev emitted on withdraw shares
     * @param pool the address of the ERC20 token of the pool
     * @param user the address of the user who withdraw the ERC20 token from the pool
     * @param withdrawShares the amount of withdraw shares which calculated from withdraw amount
     * @param withdrawAmount the amount of the ERC20 token that withdrew from the pool
     */
    event Withdraw(
        address indexed pool,
        address indexed user,
        uint256 withdrawShares,
        uint256 withdrawAmount
    );

    /**
     * @dev emitted on liquidate
     * @param user the address of the user who is liquidated by liquidator
     * @param pool the address of the ERC20 token which is liquidated by liquidator
     * @param collateral the address of the ERC20 token that liquidator received as a reward
     * @param liquidateAmount the amount of the ERC20 token that liquidator liquidate for the user
     * @param liquidateShares the amount of liquidate shares which calculated from liquidate amount
     * @param collateralAmount the amount of the collateral which calculated from liquidate amount that liquidator want to liquidate
     * @param collateralShares the amount of collateral shares which liquidator received from liquidation in from of share token
     * @param liquidator the address of the liquidator
     */
    event Liquidate(
        address indexed user,
        address pool,
        address collateral,
        uint256 liquidateAmount,
        uint256 liquidateShares,
        uint256 collateralAmount,
        uint256 collateralShares,
        address liquidator
    );

    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    // The status of each asset pool
    enum PoolStatus {
        INACTIVE,
        ACTIVE,
        CLOSED
    }

    // The struct for storing the user's state per asset pool
    struct UserPoolData {
        // Is this pool disabled as collateral for borrowing asset?
        bool disableAsCollateral;
        // Amount of borrowed shares of the user for this pool
        uint256 borrowShares;
    }

    // The struct for storing the information of current states and the configuration per asset pool.
    struct Pool {
        PoolStatus status;
        AssetPoolShare shareToken;
        PoolConfiguration poolConfig;
        uint256 totalBorrows;
        uint256 totalBorrowShares;
        uint256 poolReserves;
        uint256 lastUpdateTimestamp;
    }

    // Mapping from ERC20 token (asset) to the Pool struct of the asset (Token address => Pool struct).
    mapping(address => Pool) public pools;

    // Mapping from a user address to an ERC20 token (asset) to the user pool data
    // User address => token (asset) address => UserPoolData struct
    mapping(address => mapping(address => UserPoolData)) public userPoolData;

    // List of assets (tokens) managed by the smart contract
    ERC20[] public tokenList;

    // Price oracle to get price in native token
    IPriceOracle priceOracle;

    // Deployer of asset pool share tokens
    AssetPoolShareDeployer public shareDeployer;

    // Max purchase percet of each liquidation is 50% of user borrowed shares.
    uint256 public constant CLOSE_FACTOR = 0.5 * 1e18;

    // 5% of loan interest are reserved for owner
    uint256 public reserveRate = 0.05 * 1e18;

    constructor(
        AssetPoolShareDeployer _shareDeployer,
        IPriceOracle _priceOracle
    ) {
        shareDeployer = _shareDeployer;
        priceOracle = _priceOracle;
    }

    /****** Price Oracle Functions ******/

    // Get the price of a token in WETH
    function getPriceInWETH(address _token) public view returns (uint256) {
        return
            _token == priceOracle.WETH()
                ? 1e18
                : priceOracle.getPriceInWETH(_token);
    }

    // Set the instance of price oracle, only owner can call this function
    function setPriceOracle(IPriceOracle _priceOracle) external onlyOwner {
        priceOracle = _priceOracle;
    }

    /****** Asset Pool: Parameter Calculation Functions ******/

    // Calculate the interest rate for a given time range based on annual interst rate
    function calculateLinearInterestRate(
        uint256 _annualRate,
        uint256 _fromTimestamp,
        uint256 _toTimestamp
    ) internal pure returns (uint256) {
        return
            ((_annualRate * (_toTimestamp - _fromTimestamp)) /
                SECONDS_PER_YEAR) + 1e18;
    }

    // Get available liquidity (A_liquidity_available) for an ERC20 token in the asset pool
    function getAvailableLiquidity(ERC20 _token) public view returns (uint256) {
        return _token.balanceOf(address(this));
    }

    // Get total liquidity of an ERC20 token in the asset pool
    function getTotalLiquidity(ERC20 _token) public view returns (uint256) {
        Pool storage pool = pools[address(_token)];
        return
            pool.totalBorrows +
            getAvailableLiquidity(_token) -
            pool.poolReserves;
    }

    // Update accumulated pool's borrow interest from last update timestamp to now, then add to total borrows for that pool.
    // Functions that use this modifier will update pool's total borrows before running the functions.
    modifier updatePoolWithInterestAndTimestamp(ERC20 _token) {
        Pool storage pool = pools[address(_token)];
        uint256 borrowInterestRate = pool
            .poolConfig
            .calculateBorrowInterestRate(
                pool.totalBorrows,
                getTotalLiquidity(_token)
            );
        uint256 cumulativeBorrowInterestRate = calculateLinearInterestRate(
            borrowInterestRate,
            pool.lastUpdateTimestamp,
            block.timestamp
        );

        // Update total borrow amount, pool reserves and last update timestamp for the pool
        uint256 previousBorrows = pool.totalBorrows;
        pool.totalBorrows =
            (cumulativeBorrowInterestRate * previousBorrows) /
            1e18;
        pool.poolReserves +=
            ((pool.totalBorrows - previousBorrows) * reserveRate) /
            1e18;
        pool.lastUpdateTimestamp = block.timestamp;
        emit PoolInterestUpdated(
            address(_token),
            cumulativeBorrowInterestRate,
            pool.totalBorrows
        );
        _;
    }

    // Get the information of te asset pool for an ERC20 token
    function getPool(ERC20 _token)
        external
        view
        returns (
            PoolStatus status,
            address shareToken,
            address poolConfig,
            uint256 totalBorrows,
            uint256 totalBorrowShares,
            uint256 totalLiquidity,
            uint256 availableLiquidity,
            uint256 lastUpdateTimestamp,
            uint256 borrowRate,
            uint256 lendingRate
        )
    {
        Pool storage pool = pools[address(_token)];
        shareToken = address(pool.shareToken);
        poolConfig = address(pool.poolConfig);
        totalBorrows = pool.totalBorrows;
        totalBorrowShares = pool.totalBorrowShares;
        totalLiquidity = getTotalLiquidity(_token);
        availableLiquidity = getAvailableLiquidity(_token);
        lastUpdateTimestamp = pool.lastUpdateTimestamp;
        status = pool.status;
        borrowRate = pool.poolConfig.calculateBorrowInterestRate(
            totalBorrows,
            totalLiquidity
        );
        lendingRate = totalLiquidity == 0
            ? 0
            : (borrowRate * totalBorrows * (1e18 - reserveRate)) /
                (totalLiquidity * 1e18);
    }

    /****** Asset Pool: Management Functions ******/

    // Initialize the ERC20 token pool, only owner can initialize the pool
    function initPool(ERC20 _token, PoolConfiguration _poolConfig)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < tokenList.length; i++) {
            require(tokenList[i] != _token, "POOL_EXIST");
        }
        string memory shareSymbol = string(
            abi.encodePacked("Asset ", _token.symbol())
        );
        string memory shareName = string(
            abi.encodePacked("Asset ", _token.name())
        );
        AssetPoolShare shareToken = shareDeployer.createAssetPoolShare(
            shareName,
            shareSymbol,
            _token
        );
        Pool memory pool = Pool(
            PoolStatus.INACTIVE,
            shareToken,
            _poolConfig,
            0,
            0,
            0,
            block.timestamp
        );
        pools[address(_token)] = pool;
        tokenList.push(_token);
        emit PoolInitialized(
            address(_token),
            address(shareToken),
            address(_poolConfig)
        );
    }

    // Update pool configuration, only owner can call this function
    function updatePool(ERC20 _token, PoolConfiguration _poolConfig)
        external
        onlyOwner
    {
        Pool storage pool = pools[address(_token)];
        require(address(pool.shareToken) != address(0), "POOL_NOT_EXIST");
        pool.poolConfig = _poolConfig;
        emit PoolConfigUpdated(address(_token), address(_poolConfig));
    }

    // Set the status of an asset pool, only owner can call this function
    function setPoolStatus(ERC20 _token, PoolStatus _status)
        external
        onlyOwner
    {
        Pool storage pool = pools[address(_token)];
        require(address(pool.shareToken) != address(0), "POOL_NOT_EXIST");
        pool.status = _status;
    }

    /****** User Ledger Calculation Functions ******/

    // Ceilling Division (Round up the calculation result)
    function divCeil(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "DIVIDED_BY_ZERO");
        uint256 c = a / b;
        if (a % b != 0) {
            c = c + 1;
        }
        return c;
    }

    // Convert token amount to liquidity share amount (round-down)
    function calculateRoundDownLiquidityShareAmount(
        ERC20 _token,
        uint256 _amount
    ) internal view returns (uint256) {
        Pool storage pool = pools[address(_token)];
        uint256 totalLiquidity = getTotalLiquidity(_token);
        uint256 totalLiquidityShares = pool.shareToken.totalSupply();
        if (totalLiquidity == 0 || totalLiquidityShares == 0) {
            return _amount;
        }
        return (_amount * totalLiquidityShares) / totalLiquidity;
    }

    // Convert token amount to liquidity share amount (round-up)
    function calculateRoundUpLiquidityShareAmount(ERC20 _token, uint256 _amount)
        internal
        view
        returns (uint256)
    {
        Pool storage pool = pools[address(_token)];
        uint256 totalLiquidity = getTotalLiquidity(_token);
        uint256 totalLiquidityShares = pool.shareToken.totalSupply();
        if (totalLiquidity == 0 || totalLiquidityShares == 0) {
            return _amount;
        }
        return divCeil(_amount * totalLiquidityShares, totalLiquidity);
    }

    // Convert token amount to borrowing share amount (round-down)
    function calculateRoundDownBorrowShareAmount(ERC20 _token, uint256 _amount)
        internal
        view
        returns (uint256)
    {
        Pool storage pool = pools[address(_token)];
        if (pool.totalBorrows == 0 || pool.totalBorrowShares == 0) {
            return 0;
        }
        return (_amount * pool.totalBorrowShares) / pool.totalBorrows;
    }

    // Convert token amount to borrowing share amount (round-up)
    function calculateRoundUpBorrowShareAmount(ERC20 _token, uint256 _amount)
        internal
        view
        returns (uint256)
    {
        Pool storage pool = pools[address(_token)];
        if (pool.totalBorrows == 0 || pool.totalBorrowShares == 0) {
            return _amount;
        }
        return divCeil(_amount * pool.totalBorrowShares, pool.totalBorrows);
    }

    // Convert liquidity share amount to token amount (round-down)
    function calculateRoundDownLiquidityAmount(
        ERC20 _token,
        uint256 _shareAmount
    ) internal view returns (uint256) {
        Pool storage pool = pools[address(_token)];
        uint256 totalLiquidity = getTotalLiquidity(_token);
        uint256 totalLiquidityShares = pool.shareToken.totalSupply();
        if (totalLiquidity == 0 || totalLiquidityShares == 0) {
            return 0;
        }
        return (_shareAmount * totalLiquidity) / totalLiquidityShares;
    }

    // Convert borrow share amount to token amount (round-up)
    function calculateRoundUpBorrowAmount(ERC20 _token, uint256 _shareAmount)
        internal
        view
        returns (uint256)
    {
        Pool storage pool = pools[address(_token)];
        if (pool.totalBorrows == 0 || pool.totalBorrowShares == 0) {
            return _shareAmount;
        }
        return
            divCeil(_shareAmount * pool.totalBorrows, pool.totalBorrowShares);
    }

    // Get compounded liquidity balance of a user in an ERC20 token asset pool
    function getUserCompoundedLiquidityBalance(address _user, ERC20 _token)
        public
        view
        returns (uint256)
    {
        Pool storage pool = pools[address(_token)];
        uint256 userLiquidityShares = pool.shareToken.balanceOf(_user);
        return calculateRoundDownLiquidityAmount(_token, userLiquidityShares);
    }

    // Get compounded borrow balance of a user in an ERC20 token asset pool
    function getUserCompoundedBorrowBalance(address _user, ERC20 _token)
        public
        view
        returns (uint256)
    {
        uint256 userBorrowShares = userPoolData[_user][address(_token)]
            .borrowShares;
        return calculateRoundUpBorrowAmount(_token, userBorrowShares);
    }

    // Get a user's liquidity (lending) balance, borrowing balance and
    // check if the user can use it as collateral for an asset pool
    function getUserPoolData(address _user, ERC20 _token)
        public
        view
        returns (
            uint256 compoundedLiquidityBalance,
            uint256 compoundedBorrowBalance,
            bool usePoolAsCollateral
        )
    {
        compoundedLiquidityBalance = getUserCompoundedLiquidityBalance(
            _user,
            _token
        );
        compoundedBorrowBalance = getUserCompoundedBorrowBalance(_user, _token);
        usePoolAsCollateral = !userPoolData[_user][address(_token)]
            .disableAsCollateral;
    }

    // Get the following information of a user
    // - The value of user's total liquidity(lending) assets
    // - The value of user's total collateral (maximum borrowable value)
    // - The value of user's total borrowed assets
    function getUserInfo(address _user)
        public
        view
        returns (
            uint256 totalLiquidityValue,
            uint256 totalCollateralValue,
            uint256 totalBorrowedValue
        )
    {
        for (uint256 i = 0; i < tokenList.length; i++) {
            ERC20 _token = tokenList[i];
            Pool storage pool = pools[address(_token)];
            (
                uint256 compoundedLiquidityBalance,
                uint256 compoundedBorrowBalance,
                bool usePoolAsCollateral
            ) = getUserPoolData(_user, _token);
            if (
                compoundedLiquidityBalance != 0 || compoundedBorrowBalance != 0
            ) {
                uint256 collateralRate = pool.poolConfig.collateralRate();
                uint256 tokenPrice = getPriceInWETH(address(_token));
                require(tokenPrice > 0, "INVALID_PRICE");
                uint256 liquidityValue = (tokenPrice *
                    compoundedLiquidityBalance) / 1e18;
                totalLiquidityValue += liquidityValue;
                if (collateralRate > 0 && usePoolAsCollateral) {
                    totalCollateralValue += ((liquidityValue * collateralRate) /
                        1e18);
                }
                totalBorrowedValue += ((tokenPrice * compoundedBorrowBalance) /
                    1e18);
            }
        }
    }

    // Check if an account is healthy (the total borrowed value doesn't exceed the total collateral value)
    function isAccountHealthy(address _user)
        public
        view
        override
        returns (bool)
    {
        (
            ,
            uint256 totalCollateralValue,
            uint256 totalBorrowedValue
        ) = getUserInfo(_user);
        return totalBorrowedValue <= totalCollateralValue;
    }

    // Set if a user can use the token as collateral
    function setUserUseTokenAsCollateral(
        address _user,
        ERC20 _token,
        bool _useAsCollateral
    ) external onlyOwner {
        UserPoolData storage userData = userPoolData[_user][address(_token)];
        userData.disableAsCollateral = !_useAsCollateral;
        // only disable as collateral need to check the account health
        if (!_useAsCollateral) {
            require(
                isAccountHealthy(_user),
                "can't set use as collateral, account is unhealthy."
            );
        }
    }

    /****** Asset Pool: User Operation Functions ******/

    // Deposit an amount of ERC20 token to an asset pool
    function deposit(ERC20 _token, uint256 _amount)
        external
        nonReentrant
        updatePoolWithInterestAndTimestamp(_token)
    {
        require(_amount > 0, "INVALID_DEPOSIT_AMOUNT");
        Pool storage pool = pools[address(_token)];
        require(pool.status == PoolStatus.ACTIVE, "INVALID_POOL_STATE");

        // 1. Calculate liquidity share amount
        uint256 shareAmount = calculateRoundDownLiquidityShareAmount(
            _token,
            _amount
        );

        // 2. Mint share token to user
        pool.shareToken.mint(msg.sender, shareAmount);

        // 3. Transfer user deposit liquidity to the pool
        _token.safeTransferFrom(msg.sender, address(this), _amount);

        emit Deposit(address(_token), msg.sender, shareAmount, _amount);
    }

    // Borrow an amount of ERC20 token from the pool
    function borrow(ERC20 _token, uint256 _amount)
        external
        nonReentrant
        updatePoolWithInterestAndTimestamp(_token)
    {
        Pool storage pool = pools[address(_token)];
        require(pool.status == PoolStatus.ACTIVE, "INVALID_POOL_STATE");
        require(
            _amount > 0 && _amount <= getAvailableLiquidity(_token),
            "INVALID_BORROW_AMOUNT"
        );

        // 1. Calculate borrow share amount
        uint256 borrowShare = calculateRoundUpBorrowShareAmount(
            _token,
            _amount
        );

        // 2. Update pool state
        pool.totalBorrows += _amount;
        pool.totalBorrowShares += borrowShare;

        // 3. Update user state
        UserPoolData storage userData = userPoolData[msg.sender][
            address(_token)
        ];
        userData.borrowShares += borrowShare;

        // 4. Transfer borrowed token from pool to user
        _token.safeTransfer(msg.sender, _amount);

        // 5. Check account health, this transaction will revert if the account is unhealthy
        require(isAccountHealthy(msg.sender), "ACCOUNT_UNHEALTHY");
        emit Borrow(address(_token), msg.sender, borrowShare, _amount);
    }

    // Internal: withdraw an ERC20 token from the pool by shares
    function withdrawInternal(ERC20 _token, uint256 _share) internal {
        Pool storage pool = pools[address(_token)];
        uint256 availableShares = pool.shareToken.balanceOf(msg.sender);
        require(pool.status != PoolStatus.INACTIVE, "INVALID_POOL_STATE");
        uint256 withdrawShares = _share;
        if (withdrawShares > availableShares) {
            withdrawShares = availableShares;
        }

        // 1. Calculate liquidity amount from shares
        uint256 withdrawAmount = calculateRoundDownLiquidityAmount(
            _token,
            withdrawShares
        );

        // 2. Burn share token from the user
        pool.shareToken.burn(msg.sender, withdrawShares);

        // 3. Transfer ERC20 tokens to user account
        _token.transfer(msg.sender, withdrawAmount);

        // 4. Check if account is healthy, if no, the transaction will be reverted
        require(isAccountHealthy(msg.sender), "ACCOUNT_UNHEALTHY");
        emit Withdraw(
            address(_token),
            msg.sender,
            withdrawShares,
            withdrawAmount
        );
    }

    function withdrawByShare(ERC20 _token, uint256 _share)
        external
        nonReentrant
        updatePoolWithInterestAndTimestamp(_token)
    {
        withdrawInternal(_token, _share);
    }

    function withdrawByAmount(ERC20 _token, uint256 _amount)
        external
        nonReentrant
        updatePoolWithInterestAndTimestamp(_token)
    {
        // calculate round up liquidity share
        uint256 withdrawShare = calculateRoundUpLiquidityShareAmount(
            _token,
            _amount
        );
        withdrawInternal(_token, withdrawShare);
    }

    // Internal: repay an ERC20 token to the pool by shares
    function repayInternal(ERC20 _token, uint256 _share) internal {
        Pool storage pool = pools[address(_token)];
        require(pool.status != PoolStatus.INACTIVE, "INVALID_POOL_STATE");
        UserPoolData storage userData = userPoolData[msg.sender][
            address(_token)
        ];
        uint256 paybackShares = _share;
        if (paybackShares > userData.borrowShares) {
            paybackShares = userData.borrowShares;
        }

        // 1. Calculate round up payback token
        uint256 paybackAmount = calculateRoundUpBorrowAmount(
            _token,
            paybackShares
        );

        // 2. Update pool state
        pool.totalBorrows -= paybackAmount;
        pool.totalBorrowShares -= paybackShares;

        // 3. Update user state
        userData.borrowShares -= paybackShares;

        // 4. Transfer payback tokens to the pool
        _token.safeTransferFrom(msg.sender, address(this), paybackAmount);
        emit Repay(address(_token), msg.sender, paybackShares, paybackAmount);
    }

    // Repay an ERC20 token to the pool by shares
    function repayByShare(ERC20 _token, uint256 _share)
        external
        nonReentrant
        updatePoolWithInterestAndTimestamp(_token)
    {
        repayInternal(_token, _share);
    }

    // Repay an ERC20 token to the pool by token amount
    function repayByAmount(ERC20 _token, uint256 _amount)
        external
        nonReentrant
        updatePoolWithInterestAndTimestamp(_token)
    {
        // calculate round down borrow share
        uint256 repayShare = calculateRoundDownBorrowShareAmount(
            _token,
            _amount
        );
        repayInternal(_token, repayShare);
    }

    // Calculate the collateral amount to be paid to liquidator given the liqudation amount
    function calculateCollateralAmount(
        ERC20 _token,
        uint256 _liquidateAmount,
        ERC20 _collateral
    ) internal view returns (uint256) {
        require(address(priceOracle) != address(0), "INVALID_PRICE_ORACLE");
        uint256 tokenUnitPrice = getPriceInWETH(address(_token));
        require(tokenUnitPrice > 0, "INVALID_TOKEN_PRICE");
        uint256 collateralUnitPrice = getPriceInWETH(address(_collateral));
        require(collateralUnitPrice > 0, "INVALID_COLLATERAL_PRICE");
        uint256 liquidationBonus = pools[address(_token)]
            .poolConfig
            .liquidationBonusRate();
        return
            (tokenUnitPrice * _liquidateAmount * liquidationBonus) /
            (collateralUnitPrice * 1e18);
    }

    /**
     * Liquidate the unhealthy user account by supplying the borrowed asset (liquidated tokens) and receiving the borrower's collateral.
     * @param _user the address of the borrower whose asset (token) will be liquidated
     * @param _token the ERC20 token to be liquidated
     * @param _shares the amount of shares for the liquidated token
     * @param _collateral the ERC20 token the liquidator will receive
     */
    function liquidate(
        address _user,
        ERC20 _token,
        uint256 _shares,
        ERC20 _collateral
    )
        external
        nonReentrant
        updatePoolWithInterestAndTimestamp(_token)
        updatePoolWithInterestAndTimestamp(_collateral)
    {
        liquidateInternal(_user, _token, _shares, _collateral);
    }

    function liquidateInternal(
        address _user,
        ERC20 _token,
        uint256 _shares,
        ERC20 _collateral
    ) internal {
        // 1. Check if the user to be liquidated is healthy, we will not liquidite healthy user
        require(!isAccountHealthy(_user), "ACCOUNT_IS_HEALTH");

        // 2. Check if the liquidation pool is active
        Pool storage liquidationPool = pools[address(_token)];
        require(
            liquidationPool.status != PoolStatus.INACTIVE,
            "INVALID_POOL_STATE"
        );

        // 3. Check if the user enables collateral
        UserPoolData storage userCollateralData = userPoolData[_user][
            address(_collateral)
        ];
        require(!userCollateralData.disableAsCollateral, "COLLATERAL_DISABLED");

        // 4. Check if the pool enables users to use the token as collateral
        Pool storage collateralPool = pools[address(_collateral)];
        require(
            collateralPool.poolConfig.collateralRate() > 0,
            "POOL_COLLATERAL_DISABLED"
        );

        // 5. Check if the user has borrowed the token that liquidator want to liquidate
        UserPoolData storage userTokenData = userPoolData[_user][
            address(_token)
        ];
        require(userTokenData.borrowShares > 0, "USER_DID_NOT_BORROW");

        // 6. Calculate the liquidation amount and shares
        uint256 maxLiquidateShares = (userTokenData.borrowShares *
            CLOSE_FACTOR) / 1e18;
        uint256 liquidateShares = _shares;
        if (liquidateShares > maxLiquidateShares) {
            liquidateShares = maxLiquidateShares;
        }
        uint256 liquidateAmount = calculateRoundUpBorrowAmount(
            _token,
            liquidateShares
        );

        // 7. Calculate collateral amount and shares
        uint256 collateralAmount = calculateCollateralAmount(
            _token,
            liquidateAmount,
            _collateral
        );
        uint256 collateralShares = calculateRoundUpLiquidityShareAmount(
            _collateral,
            collateralAmount
        );

        // 8. Transfer the liqudation token to the pool
        _token.safeTransferFrom(msg.sender, address(this), liquidateAmount);

        // 9. Burn share tokens for collateral that the user has deposited
        require(
            collateralPool.shareToken.balanceOf(_user) > collateralShares,
            "INSUFFICIENT_COLLATERAL"
        );
        collateralPool.shareToken.burn(_user, collateralShares);

        // 10. Mint share token for collateral that are paid to liquidator
        collateralPool.shareToken.mint(msg.sender, collateralShares);

        // 11. Update liquidation pool state
        liquidationPool.totalBorrows -= liquidateAmount;
        liquidationPool.totalBorrowShares -= liquidateShares;

        // 12. Update user's state
        userTokenData.borrowShares -= liquidateShares;

        emit Liquidate(
            _user,
            address(_token),
            address(_collateral),
            liquidateAmount,
            liquidateShares,
            collateralAmount,
            collateralShares,
            msg.sender
        );
    }

    // Set reserve percent for owner
    function setReserveRate(uint256 _reserveRate) external onlyOwner {
        reserveRate = _reserveRate;
    }

    // Withdraw reserves, only owner can call the function
    function withdrawReserve(ERC20 _token, uint256 _amount)
        external
        nonReentrant
        updatePoolWithInterestAndTimestamp(_token)
        onlyOwner
    {
        Pool storage pool = pools[address(_token)];
        uint256 poolBalance = _token.balanceOf(address(this));
        // Owner can't withdraw more than pool's balance
        require(_amount <= poolBalance, "INSUFFICIENT_BALANCE");
        // Owner can't withdraw more than pool's reserve
        require(_amount <= pool.poolReserves, "INSUFFICIENT_POOL_RESERVES");
        _token.safeTransfer(msg.sender, _amount);
        pool.poolReserves -= _amount;
    }
}
