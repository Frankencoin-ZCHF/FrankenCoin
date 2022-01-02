// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";

interface IFrankencoin is IERC20 {

    function applyForMinting() external;

    function denyMinter(address minter) external;
    
    function mint(address target, uint256 amount, uint32 capitalRatio) external;

    function burn(address owner, uint256 amount, uint32 capitalRatio) external;

    function excessReserves() external returns (uint256);

}