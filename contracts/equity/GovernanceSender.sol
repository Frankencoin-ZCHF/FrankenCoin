// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {SyncVote, SyncMessage} from "./IGovernance.sol";
import {Governance} from "./Governance.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {IERC20} from "../erc20/IERC20.sol";
import {CCIPSender} from "../bridge/CCIPSender.sol";

contract GovernanceSender is CCIPSender {
    Governance public immutable GOVERNANCE;

    event VotesSynced(
        uint64 indexed chain, // The chain selector of the destination chain.
        bytes receiver,
        address[] syncedVoters
    );

    constructor(Governance _governance, IRouterClient _router, address _linkToken) CCIPSender(_router, _linkToken) {
        GOVERNANCE = _governance;
    }

    function syncVotes(uint64 chain, address _receiver, address[] calldata _voters) external payable {
        syncVotes(chain, _toReceiver(_receiver), _voters, "");
    }

    function syncVotes(uint64 chain, address _receiver, address[] calldata _voters, Client.EVMExtraArgsV2 calldata _extraArgs) public payable {
        syncVotes(chain, _toReceiver(_receiver), _voters, Client._argsToBytes(_extraArgs));
    }

    /**
     * @notice Sync governance votes to destination paying with native token
     * @dev extraArgs for CCIP can be provided such as gasLimit or out-of-order execution
     *
     * @param _receiver                 Address of the recipient on the destination chain
     * @param chain Chain selector of the destination chain
     * @param _voters                   Collection of addresses which votes and delegation should be synced
     *
     */
    function syncVotes(uint64 chain, bytes memory _receiver, address[] calldata _voters, bytes memory _extraArgs) public payable {
        SyncMessage memory syncMessage = _buildSyncMessage(_voters);
        Client.EVM2AnyMessage memory message = _constructMessage(_receiver, abi.encode(syncMessage), new Client.EVMTokenAmount[](0), _extraArgs);
        _send(chain, message);
        emit VotesSynced(chain, _receiver, _voters);
    }

    function getSyncFee(uint64 chain, address _receiver, address[] calldata _voters, bool useNativeToken) external view returns (uint256) {
        return getSyncFee(chain, _toReceiver(_receiver), _voters, useNativeToken, "");
    }

    function getSyncFee(uint64 chain, address _receiver, address[] calldata _voters, bool useNativeToken, Client.EVMExtraArgsV2 calldata extraArgs) external view returns (uint256) {
        return getSyncFee(chain, _toReceiver(_receiver), _voters, useNativeToken, Client._argsToBytes(extraArgs));
    }

    /**
     * @notice Get the fee required to send a CCIP message.
     * @param chain The selector of the destination chain.
     * @param _voters                   Collection of addresses which votes and delegation should be synced
     *
     * @return uint256 The fee required to send the CCIP message.
     */
    function getSyncFee(uint64 chain, bytes memory _receiver, address[] calldata _voters, bool nativeToken, bytes memory extraArgs) public view returns (uint256) {
        SyncMessage memory syncMessage = _buildSyncMessage(_voters);
        Client.EVM2AnyMessage memory message = _constructMessage(_receiver, abi.encode(syncMessage), new Client.EVMTokenAmount[](0), nativeToken, extraArgs);
        return _calculateFee(chain, message);
    }

    /**
     * @notice Builds the CCIP payload to be sent
     * @dev Gets the necessary information for voters from governance
     * @param _voters           Voters to be synced
     *
     * @return SyncMessage The payload to be sent
     */
    function _buildSyncMessage(address[] calldata _voters) private view returns (SyncMessage memory) {
        SyncVote[] memory _syncVotes = new SyncVote[](_voters.length);

        // omitted unchecked optimization for readability
        for (uint256 i = 0; i < _voters.length; i++) {
            _syncVotes[i] = SyncVote({voter: _voters[i], votes: GOVERNANCE.votes(_voters[i]), delegatee: GOVERNANCE.delegates(_voters[i])});
        }

        return SyncMessage({votes: _syncVotes, totalVotes: GOVERNANCE.totalVotes()});
    }
}
