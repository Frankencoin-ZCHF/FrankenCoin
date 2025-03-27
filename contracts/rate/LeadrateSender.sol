// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {Leadrate} from "./Leadrate.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {CCIPSender} from "../bridge/CCIPSender.sol";

contract LeadrateSender is CCIPSender {
    Leadrate public immutable LEADRATE;

    event Pushed(uint64 chain, bytes indexed bridgedLeadrate, uint24 newRatePPM);

    error LengthMismatch(uint256 expected, uint256 given);

    constructor(Leadrate _leadrate, IRouterClient _router, address _linkToken) CCIPSender(_router, _linkToken) {
        LEADRATE = _leadrate;
    }

    function pushLeadrate(uint64[] calldata chains, bytes[] calldata targets) external payable {
        if (chains.length != targets.length) revert LengthMismatch(chains.length, targets.length);
        _applyPendingChanges();
        uint24 currentRate = LEADRATE.currentRatePPM();
        for (uint256 i; i < chains.length; i++) {
            _send(chains[i], _constructMessage(targets[i], buildSyncMessage(currentRate), ""));
            emit Pushed(chains[i], targets[i], currentRate);
        }
    }

    function pushLeadrate(uint64 chain, address target) external payable {
        pushLeadrate(chain, _toReceiver(target));
    }

    function pushLeadrate(uint64 chain, bytes memory target) public payable {
        _applyPendingChanges();
        uint24 currentRate = LEADRATE.currentRatePPM();
        Client.EVM2AnyMessage memory message = _constructMessage(target, buildSyncMessage(currentRate), "");
        (, uint256 fee) = _send(chain, message);
        emit Pushed(chain, target, currentRate);
    }

    function _applyPendingChanges() internal {
        if (LEADRATE.currentRatePPM() != LEADRATE.nextRatePPM() && LEADRATE.nextChange() < block.timestamp) {
            LEADRATE.applyChange(); // there is a pending change to apply
        }
    }

    function buildSyncMessage(uint24 currentRate) internal returns (bytes memory) {
        return abi.encode(currentRate);
    }

}
