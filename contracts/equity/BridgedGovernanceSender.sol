// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {SyncVote, SyncMessage} from "./IGovernance.sol";
import {Governance} from "./Governance.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {IERC20} from "../erc20/IERC20.sol";
import {CCIPSender} from "../bridge/CCIPSender.sol";

contract BridgedGovernanceSender is CCIPSender {
    Governance public immutable GOVERNANCE;

    event VotesSynced(
        bytes32 indexed messageId, // The unique ID of the CCIP message.
        uint64 indexed destinationChainSelector, // The chain selector of the destination chain.
        address[] syncedVoters
    );

    error InsufficientBalance(uint256 available, uint256 required);
    constructor(Governance _governance, IRouterClient _router) CCIPSender(_router) {
        GOVERNANCE = _governance;
    }

    /**
     * @notice Sync governance votes to destination paying with native token
     * @dev extraArgs for CCIP can be provided such as gasLimit or out-of-order execution
     *
     * @param _receiver                 Address of the recipient on the destination chain
     * @param _destinationChainSelector Chain selector of the destination chain
     * @param _voters                   Collection of addresses which votes and delegation should be synced
     * @param _extraArgs                Extra args for ccip message
     *
     * @return messageId bytes32 MessageID of the sent message
     */
    function syncVotes(
        uint64 _destinationChainSelector,
        bytes calldata _receiver,
        address _feeTokenAddress,
        address[] calldata _voters,
        bytes calldata _extraArgs
    ) external payable returns (bytes32 messageId) {
        SyncMessage memory syncMessage = _buildSyncMessage(_voters);
        Client.EVM2AnyMessage memory message = _getCCIPMessage(
            _receiver,
            _feeTokenAddress,
            abi.encode(syncMessage),
            new Client.EVMTokenAmount[](0),
            _extraArgs
        );

        messageId = _send(_destinationChainSelector, message);

        emit VotesSynced({
            messageId: messageId,
            destinationChainSelector: _destinationChainSelector,
            syncedVoters: _voters
        });
    }

    /**
     * @notice Gathers necessary information and builds the CCIP message to be sent
     * @dev Gets the necessary information for voters from governance
     *
     * @param _receiver                 Address of the recipient on the destination chain
     * @param _feeTokenAddress          Token used to pay the ccip fees
     * @param _voters                   Collection of addresses which votes and delegation should be synced
     * @param _extraArgs                Extra args for ccip message
     *
     * @return Client.EVM2AnyMessage The CCIP message to be sent
     */
    function getCCIPMessage(
        bytes calldata _receiver,
        address _feeTokenAddress,
        address[] calldata _voters,
        bytes calldata _extraArgs
    ) public view returns (Client.EVM2AnyMessage memory) {
        SyncMessage memory syncMessage = _buildSyncMessage(_voters);
        return
            _getCCIPMessage(
                _receiver,
                _feeTokenAddress,
                abi.encode(syncMessage),
                new Client.EVMTokenAmount[](0),
                _extraArgs
            );
    }

    /**
     * @notice Get the fee required to send a CCIP message.
     * @param _destinationChainSelector The selector of the destination chain.
     * @param _feeTokenAddress          The address of the fee token.
     * @param _voters                   Collection of addresses which votes and delegation should be synced
     * @param _extraArgs                Extra args for ccip message
     *
     * @return uint256 The fee required to send the CCIP message.
     */
    function getCCIPFee(
        bytes calldata _receiver,
        uint64 _destinationChainSelector,
        address _feeTokenAddress,
        address[] calldata _voters,
        bytes calldata _extraArgs
    ) public view returns (uint256) {
        SyncMessage memory syncMessage = _buildSyncMessage(_voters);
        return
            _getCCIPFee(
                _destinationChainSelector,
                _receiver,
                _feeTokenAddress,
                abi.encode(syncMessage),
                new Client.EVMTokenAmount[](0),
                _extraArgs
            );
    }

    /**
     * @notice Builds the CCIP message to be sent
     * @dev Gets the necessary information for voters from governance
     *
     * @param _receiver         Address of the recipient on the destination chain
     * @param _feeTokenAddress  Token used to pay the ccip fees
     * @param _totalVotes       Total votes available in governance
     * @param _votes            Collection of SyncVote
     * @param _extraArgs        Extra args for ccip message
     *
     * @return Client.EVM2AnyMessage The CCIP message to be sent
     */
    function _buildSyncMessage(address[] calldata _voters) private pure returns (SyncMessage memory) {
        SyncVote[] memory _syncVotes = new SyncVote[](_voters.length);

        // omitted unchecked optimization for readability
        for (uint256 i = 0; i < _voters.length; i++) {
            _syncVotes[i] = SyncVote({
                voter: _voters[i],
                votes: GOVERNANCE.votes(_voters[i]),
                delegatee: GOVERNANCE.delegates(_voters[i])
            });
        }

        return SyncMessage({votes: _syncVotes, totalVotes: GOVERNANCE.totalVotes()});
    }
}
