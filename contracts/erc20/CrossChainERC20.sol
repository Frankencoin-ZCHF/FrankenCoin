// SPDX-License-Identifier: MIT
// Copied from https://github.com/transmissions11/solmate/blob/main/src/tokens/ERC20.sol
// and modified it.

pragma solidity ^0.8.0;

import "./ERC20.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {CCIPSender} from "../bridge/CCIPSender.sol";

abstract contract CrossChainERC20 is ERC20, CCIPSender {

    event Transfer(address indexed from, uint64 toChain, bytes indexed to, uint256 value);

    constructor(address router, address linkToken) CCIPSender(IRouterClient(router), linkToken) {}

    function transfer(uint64 targetChain, address target, uint256 amount) external payable {
        transfer(targetChain, _toReceiver(target), amount);
    }

    function transfer(uint64 targetChain, bytes memory target, uint256 amount) public payable {
        _send(targetChain, constructTransferMessage(target, amount));
        emit Transfer(msg.sender, targetChain, target, amount);
    }

    /// @notice Construct a CCIP message.
    /// @dev This function will create an EVM2AnyMessage struct with all the necessary information for tokens transfer.
    /// @param receiver The address of the receiver.
    /// @param amount The amount of the token to be transferred.
    /// @return Client.EVM2AnyMessage Returns an EVM2AnyMessage struct which contains information for sending a CCIP message.
    function constructTransferMessage(bytes memory receiver, uint256 amount) private view returns (Client.EVM2AnyMessage memory) {
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount(address(this), amount);
        return _constructMessage(receiver, "", tokenAmounts);
    }
}
