// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {SyncVote, SyncMessage} from "./BridgedGovernanceTypes.sol";
import {Governance} from "./Governance.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {IERC20} from "../erc20/IERC20.sol";

contract BridgedGovernanceSender {
    Governance public immutable GOVERNANCE;

    // Could change in the future. So no immutable for us here
    // We cannot deploy a new version easily because the Satellites use this contract address
    // as immutable.
    // TODO Define where we want to have the immutablility
    IRouterClient public router;
    IERC20 public ccipFeeToken;

    event MessageSent(
        bytes32 indexed messageId, // The unique ID of the CCIP message.
        uint64 indexed destinationChainSelector, // The chain selector of the destination chain.
        address destination, // The address of the receiver on the destination chain.
        address feeToken, // the token address used to pay CCIP fees.
        uint256 fees, // The fees paid for sending the CCIP message.
        address[] syncedVoters
    );

    error InsufficientBalance(uint256 available, uint256 required);

    constructor(Governance _governance, IRouterClient _router, IERC20 _ccipFeeToken) {
        GOVERNANCE = _governance;
        router = _router;
        ccipFeeToken = _ccipFeeToken;
    }

    function syncVotesPayToken(
        address _destination,
        uint64 _destinationChainSelector,
        address[] calldata _voters
    ) external returns (bytes32 messageId) {
        Client.EVM2AnyMessage memory message = _getCCIPMessage(_destination, _voters, address(ccipFeeToken));
        uint256 fees = router.getFee(_destinationChainSelector, message);
        uint256 availableBalance = ccipFeeToken.balanceOf(address(this));

        if (fees > availableBalance) {
            revert InsufficientBalance({available: availableBalance, required: fees});
        }

        ccipFeeToken.approve(address(router), fees);

        messageId = router.ccipSend(_destinationChainSelector, message);

        emit MessageSent({
            messageId: messageId,
            destinationChainSelector: _destinationChainSelector,
            destination: _destination,
            feeToken: address(ccipFeeToken),
            fees: fees,
            syncedVoters: _voters
        });

        // cleanup left over dust. We don't care about success
        ccipFeeToken.transfer(msg.sender, ccipFeeToken.balanceOf(address(this)));
    }

    function syncVotesPayNative(
        address _destination,
        uint64 _destinationChainSelector,
        address[] calldata _voters
    ) external returns (bytes32 messageId) {
        Client.EVM2AnyMessage memory message = _getCCIPMessage(_destination, _voters, address(0));
        uint256 fees = router.getFee(_destinationChainSelector, message);
        uint256 availableBalance = address(this).balance;

        if (fees > availableBalance) {
            revert InsufficientBalance({available: availableBalance, required: fees});
        }

        messageId = router.ccipSend{value: fees}(_destinationChainSelector, message);

        emit MessageSent({
            messageId: messageId,
            destinationChainSelector: _destinationChainSelector,
            destination: _destination,
            feeToken: address(ccipFeeToken),
            fees: fees,
            syncedVoters: _voters
        });

        // cleanup left over dust. We don't care about success
        payable(address(msg.sender)).call{value: address(this).balance}("");
    }

    function _getCCIPMessage(
        address _destination,
        address[] calldata _voters,
        address _feeTokenAddress
    ) internal view returns (Client.EVM2AnyMessage memory) {
        SyncVote[] memory syncVotes = new SyncVote[](_voters.length);
        for (uint256 i = 0; i < _voters.length; ) {
            syncVotes[i] = SyncVote({
                voter: _voters[i],
                votes: GOVERNANCE.votes(_voters[i]),
                delegatee: GOVERNANCE.delegates(_voters[i])
            });

            unchecked {
                ++i;
            }
        }

        return _buildCCIPMessage(_destination, _feeTokenAddress, GOVERNANCE.totalVotes(), syncVotes);
    }

    function _buildCCIPMessage(
        address _receiver,
        address _feeTokenAddress,
        uint256 _totalVotes,
        SyncVote[] memory _votes
    ) private pure returns (Client.EVM2AnyMessage memory) {
        SyncMessage memory _syncMessage = SyncMessage({votes: _votes, totalVotes: _totalVotes});

        return
            Client.EVM2AnyMessage({
                receiver: abi.encode(_receiver),
                data: abi.encode(_syncMessage),
                tokenAmounts: new Client.EVMTokenAmount[](0), // Empty array as no tokens are transferred
                extraArgs: Client._argsToBytes(
                    // Additional arguments, setting gas limit and allowing out-of-order execution.
                    // Best Practice: For simplicity, the values are hardcoded. It is advisable to use a more dynamic approach
                    // where you set the extra arguments off-chain. This allows adaptation depending on the lanes, messages,
                    // and ensures compatibility with future CCIP upgrades. Read more about it here: https://docs.chain.link/ccip/best-practices#using-extraargs
                    Client.EVMExtraArgsV2({
                        gasLimit: 200_000, // Gas limit for the callback on the destination chain
                        allowOutOfOrderExecution: true // Allows the message to be executed out of order relative to other messages from the same sender
                    })
                ),
                // Set the feeToken to a feeTokenAddress, indicating specific asset will be used for fees
                feeToken: _feeTokenAddress
            });
    }
}
