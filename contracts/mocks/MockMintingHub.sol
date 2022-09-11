// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../MintingHub.sol";

// this minting hub stores the address of
// the last position created. Otherwise cumbersome to
// access through hardhat/ethers
contract MockMintingHub is MintingHub {

    address public lastPositionAddress;
    constructor(address _zchf, address _factory) MintingHub (_zchf, _factory){}

    function openPositionMock(address _collateral, uint256 _minCollateral, 
        uint256 _initialCollateral, uint256 _initialLimit, 
        uint256 _duration, uint32 _fees, uint32 _reserve) 
        public returns (address) 
    {
        lastPositionAddress = openPosition(_collateral, _minCollateral,_initialCollateral,
            _initialLimit, _duration, _fees, _reserve);
        return lastPositionAddress;
    }

}