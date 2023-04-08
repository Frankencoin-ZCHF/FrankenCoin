// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";

interface IReserve is IERC20 {
   function checkQualified(address sender, address[] calldata helpers) external view;
}