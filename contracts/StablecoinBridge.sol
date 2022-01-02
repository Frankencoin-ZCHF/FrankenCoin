// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IMinter.sol";
import "./IFrankencoin.sol";

/**
 * A minting contract for another CHF stablecoin that we trust.
 */
contract StablecoinBridge is IMinter {

    IERC20 immutable chf;
    IFrankencoin immutable zchf; 

    constructor(address other, address zchfAddress){
        chf = IERC20(other);
        zchf = IFrankencoin(zchfAddress);
    }

    function mint(address target, uint256 amount) external {
        chf.transferFrom(msg.sender, address(this), amount);
        zchf.mint(target, amount);
    }

    function burn(address target, uint256 amount) external {
        zchf.burn(msg.sender, amount);
        chf.transfer(target, amount);
    }
    
    function capitalRatio() external pure returns (uint32){
        return 0; // no capital required, we trust XCHF
    }
}