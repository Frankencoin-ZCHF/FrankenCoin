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

    constructor(IFrankencoin zchf_) {
        zchf = zchf_;
    }

    /**
     * Roll the whole source position into the target position (or a clone thereof) while taking
     * as much as possible from the caller's ZCHF balance for repayment.
     */
    function rollFully(IPosition source, IPosition target) external {
        uint256 necessaryRepayment = findRepaymentAmount(source);
        uint256 collateralBalance = IERC20(source.collateral()).balanceOf(address(source));
        uint256 senderBalance = IERC20(address(zchf)).balanceOf(msg.sender);
        uint256 necessaryBorrowing = senderBalance >= necessaryRepayment ? 0 : necessaryRepayment - senderBalance; // TODO: this does not work yet, we need to mint more
        roll(source, target, necessaryBorrowing, necessaryRepayment, collateralBalance, target.expiration());
    }

    function findRepaymentAmount(IPosition pos) public returns (uint256) {
        uint256 minted = pos.minted();
        uint24 reservePPM = pos.reserveContribution();
        uint256 lowerResult = zchf.calculateFreedAmount(0, reservePPM);
        if (lowerResult == minted){
            return 0;
        }
        uint256 higherResult = zchf.calculateFreedAmount(minted, reservePPM);
        if (higherResult == minted){
            return minted;
        }
        require(lowerResult < higherResult);
        return binarySearch(minted, reservePPM, 0, lowerResult, minted, higherResult);
    }

    // max call stack depth is 1024 in solidity. Binary search on 256 bit number takes at most 256 steps, so it should be fine.
    function binarySearch(uint256 target, uint24 reservePPM, uint256 lowerBound, uint256 lowerResult, uint256 higherBound, uint256 higherResult) internal returns (uint256) {
        uint256 middle = (lowerBound + higherBound) / 2;
        uint256 middleResult = zchf.calculateFreedAmount(middle, reservePPM);
        require(lowerResult < middleResult && middleResult < higherResult, "Caramba!");
        if (middleResult == target){
            return middle;
        } else if (middleResult < target){
            return binarySearch(target, reservePPM, middle, middleResult, higherBound, higherResult);
        } else {
            return binarySearch(target, reservePPM, lowerBound, lowerResult, middle, middleResult);
        }
    }

    function roll(IPosition source, IPosition target, uint256 borrowAmount, uint256 repayAmount, uint256 collateralTransferAmount, uint40 expiration) public own(source) {
        zchf.mint(address(this), repayAmount); // take a flash loan
        source.repay(repayAmount);
        if (Ownable(address(target)).owner() != msg.sender || expiration < target.expiration()){
            source.withdrawCollateral(address(this), collateralTransferAmount);
            IERC20(source.collateral()).approve(target.hub(), collateralTransferAmount);
            target = IPosition(IMintingHub(target.hub()).clone(msg.sender, address(target), collateralTransferAmount, borrowAmount, expiration));
        } else {
            // we can roll into the provided existing position
            source.withdrawCollateral(address(target), collateralTransferAmount);
            target.mint(msg.sender, borrowAmount);
        }
        zchf.burnFrom(msg.sender, repayAmount); // repay the flash loan
    }

    modifier own(IPosition pos) {
        if (Ownable(address(pos)).owner() != msg.sender) revert NotOwner(address(pos));
        _;
    }
}

interface IMintingHub {
    function clone(address owner, address parent, uint256 _initialCollateral, uint256 _initialMint, uint40 expiration) external returns (address);
}
