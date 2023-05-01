// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPairFactory.sol";
import "./libraries/Helper.sol";
import "./TokenPair.sol";

contract PairFactory is IPairFactory, Ownable {
    bytes32 public constant INIT_CODE_PAIR_HASH =
        keccak256(abi.encodePacked(type(TokenPair).creationCode));
    address public rewardTo;
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    constructor() {
        rewardTo = msg.sender;
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function setRewardTo(address _rewardTo) external onlyOwner {
        rewardTo = _rewardTo;
    }

    function createPair(address tokenA, address tokenB)
        external
        returns (address pair)
    {
        // Step 1: Sort the token
        (address _tokenA, address _tokenB) = Helper.sortTokens(tokenA, tokenB);
        require(getPair[_tokenA][_tokenB] == address(0), "PAIR_ALREADY_EXISTS");

        // Step 2: Prepare for create2 arguments
        bytes memory bytecode = type(TokenPair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(_tokenA, _tokenB));

        // Step 3: Deploy the token pair on the address
        // calculated with the factory's address, bytecode and
        // salt.
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        // Step 4: Initialize the token pair with token addresses
        ITokenPair(pair).initialize(_tokenA, _tokenB);

        // Step 5: Store the new token pair address in factory.
        getPair[_tokenA][_tokenB] = pair;
        getPair[_tokenB][_tokenA] = pair;
        allPairs.push(pair);

        emit PairCreated(_tokenA, _tokenB, pair, allPairs.length);
    }

    // Only for testing purpose (Verify the Helper.pairFor function)
    function pairFor(address tokenA, address tokenB)
        external
        view
        returns (address pair)
    {
        pair = Helper.pairFor(
            address(this),
            tokenA,
            tokenB,
            INIT_CODE_PAIR_HASH
        );
    }
}
