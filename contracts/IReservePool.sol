// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";

interface IReservePool is IERC20 {
   function delegateVoteTo(address delegate) external;
   function isQualified(address sender, address[] calldata helpers) external returns (bool);
   function redeem(uint256 shares) external returns (uint256);
   function redeemableBalance(address holder) external returns (uint256);
}