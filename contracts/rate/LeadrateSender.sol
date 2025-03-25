// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
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
    ) external payable {
        if (_destinationChainSelectors.length != _bridgedLeadrates.length) {
            revert LengthMismatch(_destinationChainSelectors.length, _bridgedLeadrates.length);
        }

        _applyPendingChanges();
        uint24 currentRate = LEADRATE.currentRatePPM();
        for (uint256 i; i < _destinationChainSelectors.length; i++) {
            Client.EVM2AnyMessage memory message = _buildCCIPMessage(_bridgedLeadrates[i], currentRate, _extraArgs);
            (, uint256 fee) = _ccipSend(_destinationChainSelectors[i], message);
            emit Pushed(_destinationChainSelectors[i], _bridgedLeadrates[i], fee, currentRate);
        }
    }

    function pushLeadrate(
        uint64 _destinationChainSelector,
        bytes calldata _bridgedLeadrate,
        bytes calldata _extraArgs
    ) external payable {
        _applyPendingChanges();
        uint24 currentRate = LEADRATE.currentRatePPM();
        Client.EVM2AnyMessage memory message = _buildCCIPMessage(_bridgedLeadrate, currentRate, _extraArgs);
        (, uint256 fee) = _ccipSend(_destinationChainSelector, message);
        emit Pushed(_destinationChainSelector, _bridgedLeadrate, fee, currentRate);
    }

    function _applyPendingChanges() internal {
        if (LEADRATE.currentRatePPM() != LEADRATE.nextRatePPM() && LEADRATE.nextChange() < block.timestamp) {
            LEADRATE.applyChange(); // there is a pending change to apply
        }
    }

    function _buildCCIPMessage(
        bytes calldata _receiver,
        uint24 _currentRate,
        bytes calldata _extraArgs
    ) private view returns (Client.EVM2AnyMessage memory) {
        return
            Client.EVM2AnyMessage({
                receiver: _receiver,
                data: abi.encode(_currentRate),
                tokenAmounts: new Client.EVMTokenAmount[](0), // Empty array as no tokens are transferred
                extraArgs: _extraArgs,
                // Set the feeToken to a feeTokenAddress, indicating specific asset will be used for fees
                feeToken: _getFeeToken()
            });
    }
}
