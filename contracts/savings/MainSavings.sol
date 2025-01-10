// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interface/IFrankencoin.sol";
import "../rate/MainLeadrate.sol";
import "./AbstractSavings.sol";

/**
 * @title Savings
 *
 * Module to enable savings based on a Leadrate ("Leitzins") module.
 *
 * As the interest rate changes, the speed at which 'ticks' are accumulated is
 * adjusted. The ticks counter serves as the basis for calculating the interest
 * due for the individual accoutns.
 *
 * The saved ZCHF are subject to a lockup of up to 3 days and only start to yield
 * an interest after the lockup ended. The purpose of this lockup is to discourage
 * short-term holdings and to avoid paying interest to transactional accounts.
 * Transactional accounts typically do not need an incentive to hold Frankencoins.
 */
abstract contract MainSavings is MainLeadrate, AbstractSavings {
    
    uint64 public immutable INTEREST_DELAY = uint64(3 days);

    IERC20 public immutable ZCHF;

    mapping(address => Account) public savings;

    struct Account {
        uint192 saved;
        uint64 ticks;
    }

    event Saved(address indexed account , uint192 amount);
    event InterestCollected(address indexed account, uint256 interest);
    event Withdrawn(address indexed account, uint192 amount);

    error FundsLocked(uint40 remainingSeconds);

    // The module is considered disabled if the interest is zero or about to become zero within three days.
    error ModuleDisabled();

    constructor(IFrankencoin zchf_, uint24 initialRatePPM) MainLeadrate(zchf_.reserve(), initialRatePPM) AbstractSavings(zchf_) {
    }

    function collectInterest(uint192 earnedInterest) internal {
        (IFrankencoin(address(ZCHF))).coverLoss(address(this), earnedInterest); 
    }
}
