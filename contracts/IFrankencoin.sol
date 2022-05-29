// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";

interface IFrankencoin is IERC20 {

    function suggestMinter(address minter, uint256 applicationPeriod, uint256 applicationFee) external;

    function denyMinter(address minter, address[] calldata helpers) external;

    function reserve() external returns (address);

    function isMinter(address minter) external returns (bool);
    
    function mint(address target, uint256 amount) external;

    function mint(address target, uint256 amount, uint32 reservePPM, uint32 feePPM) external;

    function burn(uint256 amount) external;

    function burn(address target, uint256 amount) external;

    function notifyLoss(uint256 amount) external;

}