// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import "../erc20/IERC20.sol";
import "../stablecoin/IFrankencoin.sol";
import "../minting/IPosition.sol";
import "./AbstractLeadrate.sol";

/**
 * @title Leadrate (attempt at translating the nicely concise German term 'Leitzins')
 *
 * A module that can provide other modules with the lead interest rate for the system.
 *
 **/
contract BridgedLeadrate is AbstractLeadrate, CCIPReceiver {
    
    constructor(address router_, uint24 initialRatePPM) AbstractLeadrate(initialRatePPM) CCIPReceiver(router_) {}

    function _ccipReceive(Client.Any2EVMMessage memory any2EvmMessage) internal override {}

    function _reportRate(uint24 newRatePPM_) internal {
        super.updateRate(newRatePPM_);
    }
}
