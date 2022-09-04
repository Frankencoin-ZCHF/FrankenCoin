// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";

interface IReservePool is IERC20 {
   function isQualified(address sender, address[] calldata helpers) external view returns (bool);
}