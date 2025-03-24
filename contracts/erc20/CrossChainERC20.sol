// SPDX-License-Identifier: MIT
// Copied from https://github.com/transmissions11/solmate/blob/main/src/tokens/ERC20.sol
// and modified it.

pragma solidity ^0.8.0;

import "./ERC20.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {CCIPSender} from "../bridge/CCIPSender.sol";

abstract contract CrossChainERC20 is ERC20, CCIPSender {
    event Transfer(address indexed from, uint64 toChain, address indexed to, uint256 value);

    constructor(address router, address linkToken) CCIPSender(IRouterClient(router), linkToken) {}

    function transfer(
        uint64 destinationChainSelector,
        address target,
        uint256 amount
    ) external payable {
        Client.EVM2AnyMessage memory message = _buildCCIPMessage(target, amount);

        _ccipSend(destinationChainSelector, message);
        emit Transfer(msg.sender, destinationChainSelector, target, amount);
    }

    /// @notice Construct a CCIP message.
    /// @dev This function will create an EVM2AnyMessage struct with all the necessary information for tokens transfer.
    /// @param _receiver The address of the receiver.
    /// @param _amount The amount of the token to be transferred.
    /// @return Client.EVM2AnyMessage Returns an EVM2AnyMessage struct which contains information for sending a CCIP message.
    function _buildCCIPMessage(
        address _receiver,
        uint256 _amount
    ) private view returns (Client.EVM2AnyMessage memory) {
        // Set the token amounts
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({token: address(this), amount: _amount});

        // Create an EVM2AnyMessage struct in memory with necessary information for sending a cross-chain message
        return
            Client.EVM2AnyMessage({
                receiver: abi.encode(_receiver), // ABI-encoded receiver address
                data: "", // No data
                tokenAmounts: tokenAmounts, // The amount and type of token being transferred
                extraArgs: Client._argsToBytes(
                    Client.EVMExtraArgsV2({
                        gasLimit: 0, // Gas limit for the ccipReceive() on destination. TODO: check what happens if this is 0 and the recipient has a ccipReceive method
                        allowOutOfOrderExecution: true // Allows the message to be executed out of order relative to other messages from the same sender
                    })
                ),
                // Set the feeToken to a feeTokenAddress, indicating specific asset will be used for fees
                feeToken: _getFeeToken()
            });
    }
}
