// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFrankencoin {
    
    function mint(address target, uint256 amount) external;

    function burn(address owner, uint256 amount) external;

}