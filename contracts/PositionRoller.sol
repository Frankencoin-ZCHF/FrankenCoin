// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interface/IERC20.sol";
import "./interface/IFrankencoin.sol";
import "./interface/IPosition.sol";
import "./utils/Ownable.sol";
import "./interface/IReserve.sol";

/**
 * @title PositionRoller
 * 
 * Helper to roll over a debt from an old position to a new one.
 * Both positions should have the same collateral. Otherwise, it does not make much sense.
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
