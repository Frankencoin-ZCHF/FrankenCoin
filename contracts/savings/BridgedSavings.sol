// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../rate/BridgedLeadrate.sol";
import "./AbstractSavings.sol";
import "../bridge/Recipient.sol";
import "../erc20/IERC20.sol";

/**
 * @title BridgedSavings
 *
 * Module to enable savings based on a Leadrate ("Leitzins") module on a layer-two chain.
 */
contract BridgedSavings is AbstractSavings, BridgedLeadrate {

    constructor(IFrankencoin zchf_, address bridge_, uint24 initialRatePPM) AbstractSavings(zchf_) BridgedLeadrate(bridge_, initialRatePPM){
    }

}