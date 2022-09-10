// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IReserve.sol";

interface IFrankencoin is IERC20 {

    function suggestMinter(address minter, uint256 applicationPeriod, uint256 applicationFee, string calldata message) external;

    function registerPosition(address position) external;

    function denyMinter(address minter, address[] calldata helpers, string calldata message) external;

    function reserve() external view returns (IReserve);

    function isMinter(address minter) external view returns (bool);

    function isPosition(address position) external view returns (address);
    
    function mint(address target, uint256 amount) external;

    function mint(address target, uint256 amount, uint32 reservePPM, uint32 feePPM) external;

    function burnWithReserve(uint256 amountExcludingReserve, uint32 reservePPM) external returns (uint256);

    function burn(address target, uint256 amount) external;

    function notifyLoss(uint256 amount) external;

}