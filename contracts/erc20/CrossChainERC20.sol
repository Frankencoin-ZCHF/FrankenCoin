// SPDX-License-Identifier: MIT
// Copied from https://github.com/transmissions11/solmate/blob/main/src/tokens/ERC20.sol
// and modified it.

pragma solidity ^0.8.0;

import "./ERC20.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

abstract contract CrossChainERC20 is ERC20 {

    IRouterClient public immutable ROUTER;

    event Transfer(address indexed from, uint64 toChain, address indexed to, uint256 value);
    event MessageSent(bytes32 id, uint256 chainlinkFee);

    constructor(address router){
        ROUTER = IRouterClient(router);
    }

    function transfer(uint64 chain, address target, uint256 amount) external payable {
        Client.EVM2AnyMessage memory message = _buildCCIPMessage(_receiver, amount);
        uint256 fees = s_router.getFee(chain, message);

        if (fees > msg.value) revert NotEnoughBalance(address(this).balance, fees);
        _transfer(msg.sender, address(this), amount); // so the router can pick it up, assuming router has allowance
        if (_allowance(address(this), address(ROUTER)) < amount) {
            _approve(address(this), address(ROUTER), amount);
        }
        bytes32 messageId = ROUTER.ccipSend{value: fees}(chain, message);
        emit MessageSent(messageId, fees);
        emit Transfer(msg.sender, chain, target, amount);
        // TODO: return excess fees
    }

    /// @notice Construct a CCIP message.
    /// @dev This function will create an EVM2AnyMessage struct with all the necessary information for tokens transfer.
    /// @param _receiver The address of the receiver.
    /// @param _token The token to be transferred.
    /// @param _amount The amount of the token to be transferred.
    /// @param _feeTokenAddress The address of the token used for fees. Set address(0) for native gas.
    /// @return Client.EVM2AnyMessage Returns an EVM2AnyMessage struct which contains information for sending a CCIP message.
    function _buildCCIPMessage(
        address _receiver,
        uint256 _amount
    ) private pure returns (Client.EVM2AnyMessage memory) {
        // Set the token amounts
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({
            token: address(this),
            amount: _amount
        });

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
                feeToken: address(0)
            });
    }
}
