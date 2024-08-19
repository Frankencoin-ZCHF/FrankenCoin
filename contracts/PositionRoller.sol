// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interface/IERC20.sol";
import "./interface/IFrankencoin.sol";
import "./interface/IPosition.sol";
import "./utils/Ownable.sol";
import "./interface/IReserve.sol";

/**
 * @title Savings
 * 
 * Module to enable savings.
 * 
 * When saving Frankencoins, a maturity date must be chosen, depending on which the interest
 * is caluclated such that the system can be sure to not pay out more than it already received
 * on the other side of the balance sheet. Savers that go in first generally have an advantage.
 * The higher the total savings, the lower the interest. Also, those who choose a short
 * duration have an advantage. This is economically unfortunate, but it is necessary to 
 * fulfill the requirement of always being sure that more interest comes in than goes out.
 * 
 */
contract PositionRoller {

    IFrankencoin private zchf;

    error NotOwner(address pos);
    error CollateralMismatch(address c1, address c2);

    constructor(IFrankencoin zchf_){
        zchf = zchf_;
    }

    function roll(IPosition source, IPosition target, uint256 borrowAmount, uint256 repayAmount, uint256 collateralTransferAmount) external own(source) own(target){
        zchf.mint(address(this), repayAmount); // take a flash loan
        source.repay(repayAmount);
        source.withdrawCollateral(address(target), collateralTransferAmount);
        target.mint(msg.sender, borrowAmount);
        zchf.burnFrom(msg.sender, repayAmount); // repay the flash loan
    }

    modifier own(IPosition pos) {
        if (Ownable(address(pos)).owner() != msg.sender) revert NotOwner(address(pos));
        _;
    }

}
