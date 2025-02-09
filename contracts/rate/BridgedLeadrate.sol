// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../erc20/IERC20.sol";
import "../stablecoin/IFrankencoin.sol";
import "../minting/IPosition.sol";
import "../bridge/Recipient.sol";
import "./AbstractLeadrate.sol";

/**
 * @title Leadrate (attempt at translating the nicely concise German term 'Leitzins')
 *
 * A module that can provide other modules with the lead interest rate for the system.
 *
 **/
contract BridgedLeadrate is AbstractLeadrate, Recipient {

    constructor(address bridge_, uint24 initialRatePPM) AbstractLeadrate(initialRatePPM) Recipient(bridge_) {
    }

    function reportRate(uint24 newRatePPM_) external bridgeOnly {
        super.updateRate(newRatePPM_);
    }

}