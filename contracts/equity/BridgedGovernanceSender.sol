// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {SyncVote, SyncMessage} from "./BridgedGovernanceTypes.sol";
import {Governance} from "./Governance.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {IERC20} from "../erc20/IERC20.sol";

contract BridgedGovernanceSender {
    Governance public immutable GOVERNANCE;
    IRouterClient public immutable ROUTER;

    event MessageSent(
        bytes32 indexed messageId, // The unique ID of the CCIP message.
        uint64 indexed destinationChainSelector, // The chain selector of the destination chain.
        address indexed receiver, // The address of the receiver on the destination chain.
        address feeToken, // the token address used to pay CCIP fees.
        uint256 fees, // The fees paid for sending the CCIP message.
        address[] syncedVoters
    );

    error InsufficientBalance(uint256 available, uint256 required);
    constructor(Governance _governance, IRouterClient _router) {
        GOVERNANCE = _governance;
        ROUTER = _router;
    }

    /**
     * @notice Sync governance votes to destination paying with ERC20 token
     * @dev extraArgs for CCIP can be provided such as gasLimit or out-of-order execution
     *
     * @param _receiver                 Address of the recipient on the destination chain
     * @param _destinationChainSelector Chain selector of the destination chain
     * @param _ccipFeeToken             Token used to pay the ccip fees
     * @param _voters                   Collection of addresses which votes and delegation should be synced
     * @param _extraArgs                Extra args for ccip message
     *
     * @return messageId bytes32 MessageID of the sent message
     */
    function syncVotesPayToken(
        address _receiver,
        uint64 _destinationChainSelector,
        IERC20 _ccipFeeToken,
        address[] calldata _voters,
        bytes calldata _extraArgs
    ) external returns (bytes32 messageId) {
        Client.EVM2AnyMessage memory message = getCCIPMessage(_receiver, address(_ccipFeeToken), _voters, _extraArgs);
        uint256 fees = ROUTER.getFee(_destinationChainSelector, message);
        uint256 availableBalance = _ccipFeeToken.balanceOf(msg.sender);

        if (fees > availableBalance) {
            revert InsufficientBalance({available: availableBalance, required: fees});
        }

        _ccipFeeToken.transferFrom(msg.sender, address(this), fees);
        _ccipFeeToken.approve(address(ROUTER), fees);

        messageId = ROUTER.ccipSend(_destinationChainSelector, message);

        emit MessageSent({
            messageId: messageId,
            destinationChainSelector: _destinationChainSelector,
            receiver: _receiver,
            feeToken: address(_ccipFeeToken),
            fees: fees,
            syncedVoters: _voters
        });
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
    function syncVotesPayNative(
        address _receiver,
        uint64 _destinationChainSelector,
        address[] calldata _voters,
        bytes calldata _extraArgs
    ) external payable returns (bytes32 messageId) {
        Client.EVM2AnyMessage memory message = getCCIPMessage(_receiver, address(0), _voters, _extraArgs);
        uint256 fees = ROUTER.getFee(_destinationChainSelector, message);
        uint256 availableBalance = address(this).balance;

        if (fees > availableBalance) {
            revert InsufficientBalance({available: availableBalance, required: fees});
        }

        messageId = ROUTER.ccipSend{value: fees}(_destinationChainSelector, message);

        emit MessageSent({
            messageId: messageId,
            destinationChainSelector: _destinationChainSelector,
            receiver: _receiver,
            feeToken: address(0),
            fees: fees,
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
        address _receiver,
        address _feeTokenAddress,
        address[] calldata _voters,
        bytes calldata _extraArgs
    ) public view returns (Client.EVM2AnyMessage memory) {
        SyncVote[] memory syncVotes = new SyncVote[](_voters.length);

        // omitted unchecked optimization for readability
        for (uint256 i = 0; i < _voters.length; i++) {
            syncVotes[i] = SyncVote({
                voter: _voters[i],
                votes: GOVERNANCE.votes(_voters[i]),
                delegatee: GOVERNANCE.delegates(_voters[i])
            });
        }

        return _buildCCIPMessage(_receiver, _feeTokenAddress, GOVERNANCE.totalVotes(), syncVotes, _extraArgs);
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
        address _receiver,
        uint64 _destinationChainSelector,
        address _feeTokenAddress,
        address[] calldata _voters,
        bytes calldata _extraArgs
    ) public view returns (uint256) {
        Client.EVM2AnyMessage memory message = getCCIPMessage(_receiver, _feeTokenAddress, _voters, _extraArgs);
        return ROUTER.getFee(_destinationChainSelector, message);
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
    function _buildCCIPMessage(
        address _receiver,
        address _feeTokenAddress,
        uint256 _totalVotes,
        SyncVote[] memory _votes,
        bytes calldata _extraArgs
    ) private pure returns (Client.EVM2AnyMessage memory) {
        SyncMessage memory _syncMessage = SyncMessage({votes: _votes, totalVotes: _totalVotes});

        return
            Client.EVM2AnyMessage({
                receiver: abi.encode(_receiver),
                data: abi.encode(_syncMessage),
                tokenAmounts: new Client.EVMTokenAmount[](0), // Empty array as no tokens are transferred
                extraArgs: _extraArgs,
                // Set the feeToken to a feeTokenAddress, indicating specific asset will be used for fees
                feeToken: _feeTokenAddress
            });
    }
}
