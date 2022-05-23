// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IFrankencoin.sol";

/**
 * A minting contract for another CHF stablecoin that we trust.
 */
contract StablecoinBridge {

    IERC20 public immutable chf;
    IFrankencoin public immutable zchf;

    uint256 public immutable horizon;

    constructor(address other, address zchfAddress){
        chf = IERC20(other);
        zchf = IFrankencoin(zchfAddress);
        horizon = block.timestamp + 52 weeks;
    }

    function mint(address target, uint256 amount) external {
        require(block.timestamp <= horizon);
        chf.transferFrom(msg.sender, address(this), amount);
        zchf.mint(target, amount, 0);
    }

    function burn(address target, uint256 amount) external {
        zchf.burn(msg.sender, amount, 0);
        chf.transfer(target, amount);
    }
    
}