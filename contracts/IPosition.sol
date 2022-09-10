// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IReservePool.sol";
import "./IFrankencoin.sol";

interface IPosition {

    function deny(address[] calldata helpers, string calldata message) external;

    function notifyChallengeStarted(uint256 size) external;

    function tryAvertChallenge(uint256 size, uint256 bid) external returns (bool);

    function notifyChallengeSucceeded(address bidder, uint256 size) external returns (uint256, uint256, uint32);

}

interface IPositionFactory {

    function reserve() external returns (IReservePool);

    function hub() external returns (address);

    function zchf() external returns (IFrankencoin);

}