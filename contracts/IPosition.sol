// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IReservePool.sol";
import "./IFrankencoin.sol";

interface IPosition {

    function getImpliedPriceE18() external view returns (uint256);

    function deny(address[] calldata helpers, string calldata message) external;

    function notifyChallengeStarted() external;

    function tryAvertChallenge(uint256 size, uint256 bid) external returns (bool);

    function getMaxChallengeSize() external view returns (uint256);

    function notifyChallengeSucceeded(address bidder, uint256 size) external returns (uint256, uint256, uint32);

}

interface IPositionFactory {

    function reserve() external returns (IReservePool);

    function hub() external returns (address);

    function zchf() external returns (IFrankencoin);

}