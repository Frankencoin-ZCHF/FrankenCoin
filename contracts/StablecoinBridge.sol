// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IFrankencoin.sol";

/**
 * A minting contract for another CHF stablecoin that we trust.
 */
contract StablecoinBridge {

    IERC20 immutable chf;
    IFrankencoin immutable zchf;

    uint256 public minted;

    constructor(address other, address zchfAddress){
        chf = IERC20(other);
        zchf = IFrankencoin(zchfAddress);
        zchf.suggestMinter(address(this));
    }

    function mint(address target, uint256 amount) external {
        minted += amount;
        chf.transferFrom(msg.sender, address(this), amount);
        // no capital required, we trust the other coin
        zchf.mint(target, amount, 0);
    }

    function burn(address target, uint256 amount) external {
        zchf.burn(msg.sender, amount, 0);
        chf.transfer(target, amount);
        minted -= amount;
    }
    
}