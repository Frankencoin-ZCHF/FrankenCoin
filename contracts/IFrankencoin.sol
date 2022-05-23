// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";

interface IFrankencoin is IERC20 {

    function suggestMinter(address minter, uint256 applicationPeriod, uint256 applicationFee) external;

    function denyMinter(address minter, address[] calldata helpers) external;

    function reserve() external returns (address);

    function hasEnoughReserves() external returns (bool);

    function isMinter(address minter) external returns (bool);
    
    function mint(address target, uint256 amount, uint256 reserveRequirementIncrement) external;

    function mintAndCall(address target, uint256 amount, uint256 reserveRequirementIncrement) external;

    function burn(address target, uint256 amount, uint256 reserveRequirementDecrement) external;

    function notifyLoss(uint256 amount) external;

}