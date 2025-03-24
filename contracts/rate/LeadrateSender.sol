// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {LeadrateSyncMessage} from "./ILeadrate.sol";
import {Leadrate} from "./Leadrate.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {CCIPSender} from "../bridge/CCIPSender.sol";

contract LeadrateSender is CCIPSender {
    Leadrate public immutable LEADRATE;

    event Pushed(
        uint64 indexed destinationChainSelectors,
        bytes indexed bridgedLeadrate,
        uint256 fee,
        uint24 newRatePPM
    );
    error LengthMismatch(uint256 expected, uint256 given);

    constructor(Leadrate _leadrate, IRouterClient _router, address _linkToken) CCIPSender(_router, _linkToken) {
        LEADRATE = _leadrate;
    }

    function pushLeadrate(
        uint64[] calldata _destinationChainSelectors,
        bytes[] calldata _bridgedLeadrates,
        bytes calldata _extraArgs
    ) external {
        if (_destinationChainSelectors.length != _bridgedLeadrates.length) {
            revert LengthMismatch(_destinationChainSelectors.length, _bridgedLeadrates.length);
        }

        _applyPendingChanges();
        LeadrateSyncMessage memory syncMessage = _getLeadrateInfos();
        for (uint256 i; i < _destinationChainSelectors.length; i++) {
            Client.EVM2AnyMessage memory message = _buildCCIPMessage(_bridgedLeadrates[i], syncMessage, _extraArgs);
            (, uint256 fee) = _ccipSend(_destinationChainSelectors[i], message);
            emit Pushed(_destinationChainSelectors[i], _bridgedLeadrates[i], fee, syncMessage.newRatePPM);
        }
    }

    function pushLeadrate(
        uint64 _destinationChainSelector,
        bytes calldata _bridgedLeadrate,
        bytes calldata _extraArgs
    ) external {
        _applyPendingChanges();
        LeadrateSyncMessage memory syncMessage = _getLeadrateInfos();
        Client.EVM2AnyMessage memory message = _buildCCIPMessage(_bridgedLeadrate, syncMessage, _extraArgs);
        (, uint256 fee) = _ccipSend(_destinationChainSelector, message);
        emit Pushed(_destinationChainSelector, _bridgedLeadrate, fee, syncMessage.newRatePPM);
    }

    function _applyPendingChanges() internal {
        if (LEADRATE.currentRatePPM() != LEADRATE.nextRatePPM() && LEADRATE.nextChange() < block.timestamp) {
            LEADRATE.applyChange(); // there is a pending change to apply
        }
    }

    function _getLeadrateInfos() private view returns (LeadrateSyncMessage memory) {
        uint24 currentRatePPM = LEADRATE.currentRatePPM();
        return LeadrateSyncMessage({newRatePPM: currentRatePPM});
    }

    function _buildCCIPMessage(
        bytes calldata _receiver,
        LeadrateSyncMessage memory _syncMessage,
        bytes calldata _extraArgs
    ) private view returns (Client.EVM2AnyMessage memory) {
        return
            Client.EVM2AnyMessage({
                receiver: _receiver,
                data: abi.encode(_syncMessage),
                tokenAmounts: new Client.EVMTokenAmount[](0), // Empty array as no tokens are transferred
                extraArgs: _extraArgs,
                // Set the feeToken to a feeTokenAddress, indicating specific asset will be used for fees
                feeToken: _getFeeToken()
            });
    }
}
