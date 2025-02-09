// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGovernance {
   function checkQualified(address sender, address[] calldata helpers) external view;
}