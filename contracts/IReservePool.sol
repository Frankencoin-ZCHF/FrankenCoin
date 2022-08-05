// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";

interface IReservePool is IERC20 {
   function delegateVoteTo(address delegate) external;
   function isQualified(address sender, address[] calldata helpers) external view returns (bool);
   function redeem(address target, uint256 shares) external returns (uint256);
   function redeemFraction(address target, uint256 partsPerMillion) external returns (uint256);
   function redeemableBalance(address holder) external view returns (uint256);
}