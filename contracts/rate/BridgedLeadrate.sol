// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interface/IERC20.sol";
import "./interface/IFrankencoin.sol";
import "./interface/IPosition.sol";
import "./interface/IReserve.sol";
import "../bridge/BridgeRecipient.sol";
import "./AbstractLeadrate.sol";

/**
 * @title Leadrate (attempt at translating the nicely concise German term 'Leitzins')
 *
 * A module that can provide other modules with the lead interest rate for the system.
 *
 **/
contract BridgedLeadRate is AbstractLeadrate, BridgeRecipient {

    address public constant MAIN_LEADRATE = 0x3BF301B0e2003E75A3e86AB82bD1EFF6A9dFB2aE;

    error WrongSource(address source);

    constructor(address bridge_, uint24 initialRatePPM) AbstractLeadrate(initialRatePPM) BridgeRecipient(bridge_) {
    }

    function updateRate(address mainnetDataSource, uint24 newRatePPM_) external bridgeOnly {
        if (mainnetDataSource != MAIN_LEADRATE) revert WrongSource(source);
        super.updateRate(newRatePPM_);
    }

}
