// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interface/IFrankencoin.sol";
import "../rate/MainLeadrate.sol";
import "./AbstractSavings.sol";

/**
 * @title Savings
 *
 * Module to enable savings based on a Leadrate ("Leitzins") module on mainnet.
 */
abstract contract MainSavings is MainLeadrate, AbstractSavings {
    
    constructor(IFrankencoin zchf_, uint24 initialRatePPM) MainLeadrate(zchf_.reserve(), initialRatePPM) AbstractSavings(zchf_, address(zchf_)) {
    }

}
