// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {ILeadrate, LeadrateSyncMessage} from "./ILeadrate.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {CCIPSender} from "../bridge/CCIPSender.sol";

contract LeadrateSender is CCIPSender {
    ILeadrate public immutable LEADRATE;

    event Synced(
        uint64[] destinationChainSelectors,
        bytes[] indexed receivers,
        uint256 fees,
        uint24 currentRatePPM,
        uint40 anchorTime,
        uint64 ticksAnchor
    );
    error LengthMismatch(uint256 expected, uint256 given);

    constructor(ILeadrate _leadrate, IRouterClient _router) CCIPSender(_router) {
        LEADRATE = _leadrate;
    }

    function sync(
        uint64[] calldata _destinationChainSelectors,
        bytes[] calldata _receivers,
        address _feeTokenAddress,
        bytes calldata _extraArgs
    ) external {
        if (_destinationChainSelectors.length != _receivers.length)
            revert LengthMismatch(_destinationChainSelectors.length, _receivers.length);

        uint256 fees;
        LeadrateSyncMessage memory syncMessage = _getLeadrateInfos();
        for (uint256 i; i < _destinationChainSelectors.length; i++) {
            Client.EVM2AnyMessage memory message = _buildCCIPMessage(
                _receivers[i],
                _feeTokenAddress,
                syncMessage,
                _extraArgs
            );
            (, uint256 fee) = _ccipSend(_destinationChainSelectors[i], message);
            fees += fee;
        }
        emit Synced(
            _destinationChainSelectors,
            _receivers,
            fees,
            syncMessage.currentRatePPM,
            syncMessage.anchorTime,
            syncMessage.ticksAnchor
        );
    }

    function _getLeadrateInfos() private view returns (LeadrateSyncMessage memory) {
        uint24 currentRatePPM = LEADRATE.currentRatePPM();
        uint64 currentTicks = LEADRATE.currentTicks();
        return
            LeadrateSyncMessage({
                currentRatePPM: currentRatePPM,
                anchorTime: uint40(block.timestamp),
                ticksAnchor: currentTicks
            });
    }

    function _buildCCIPMessage(
        bytes calldata _receiver,
        address _feeTokenAddress,
        LeadrateSyncMessage memory _syncMessage,
        bytes calldata _extraArgs
    ) private pure returns (Client.EVM2AnyMessage memory) {
        return
            Client.EVM2AnyMessage({
                receiver: _receiver,
                data: abi.encode(_syncMessage),
                tokenAmounts: new Client.EVMTokenAmount[](0), // Empty array as no tokens are transferred
                extraArgs: _extraArgs,
                // Set the feeToken to a feeTokenAddress, indicating specific asset will be used for fees
                feeToken: _feeTokenAddress
            });
    }
}
