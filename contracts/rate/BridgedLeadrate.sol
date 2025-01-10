// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interface/IERC20.sol";
import "./interface/IFrankencoin.sol";
import "./interface/IPosition.sol";
import "./interface/IReserve.sol";
import "./AbstractLeadrate.sol";

/**
 * @title Leadrate (attempt at translating the nicely concise German term 'Leitzins')
 *
 * A module that can provide other modules with the lead interest rate for the system.
 *
 **/
contract BridgedLeadRate is AbstractLeadrate {

    address public constant MAINxxxx

    address public immutable bridge;

    error NotBridge();
    error WrongSource();

    constructor(IReserve bridge_, uint24 initialRatePPM) AbstractLeadrate(initialRatePPM) {
        bridge = bridge_;
    }

    modifier bridgeOnly() {
        if (msg.sender != bridge) revert NotBridge();
        _;
    }

    function updateRate(address mainnetDataSource, uint24 newRatePPM_) external bridgeOnly {
        super.updateRate(newRatePPM_);
    }

}
