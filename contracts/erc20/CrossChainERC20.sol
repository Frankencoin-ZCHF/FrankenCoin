// SPDX-License-Identifier: MIT
// Copied from https://github.com/transmissions11/solmate/blob/main/src/tokens/ERC20.sol
// and modified it.

pragma solidity ^0.8.0;

import "./ERC20.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

abstract contract CrossChainERC20 is ERC20 {

    IERC20 public immutable LINK = IERC20(0x514910771af9ca656af840dff83e8264ecf986ca);
    IRouterClient public immutable ROUTER;

    event Transfer(address indexed from, uint64 toChain, address indexed to, uint256 value);
    event MessageSent(bytes32 id, uint256 chainlinkFee);

    error NotEnoughLinkTokens(uint256 balance, uint256 required);
    error MissingLinkAllowance(uint256 required);
    error NotEnoughEther(uint256 provided, uint256 required);

    constructor(address router){
        ROUTER = IRouterClient(router);
    }

    /**
     * Like transfer but with an additional parameter to specify a target blockchain.
     * 
     * The sender must either provide sufficient Ether or allow spending LINK tokens to pay for the
     * cross-chain message.
     */
    function transfer(uint64 chain, address target, uint256 amount) external payable {
        bool useNative = msg.value > 0;
        Client.EVM2AnyMessage memory message = _buildCCIPMessage(_receiver, amount, useNative ? address(0) : address(LINK));
        
        bool link = LINK.allowance(msg.sender, address(this)) > 
        uint256 fees = s_router.getFee(chain, message);
        if (useNative){
            if (fees > address(this).balance) revert NotEnoughEther(address(this).balance, fees);
            msg.sender.call{value: address(this).balance - fees}(""); // return excess fees
        } else {
            if (LINK.balanceOf(msg.sender) < fees) revert NotEnoughLinkTokens(LINK.balanceOf(msg.sender), fees);
            if (LINK.allowance(msg.sender, address(this)) < fees) revert MissingLinkAllowance(fees);
            LINK.transferFrom(msg.sender, address(this), fees);
            LINK.approve(address(ROUTER), fees);
        }
        _transfer(msg.sender, address(this), amount);  // move tokens here
        _approve(address(this), address(ROUTER), amount); // and allow the router to pick the up
        bytes32 messageId = ROUTER.ccipSend{value: fees}(chain, message);
        emit MessageSent(messageId, fees);
        emit Transfer(msg.sender, chain, target, amount);
    }

    /// @notice Construct a CCIP message.
    /// @dev This function will create an EVM2AnyMessage struct with all the necessary information for tokens transfer.
    /// @param _receiver The address of the receiver.
    /// @param _amount The amount of the token to be transferred.
    /// @param feeToken The address of the token used for fees. Set address(0) for native gas.
    /// @return Client.EVM2AnyMessage Returns an EVM2AnyMessage struct which contains information for sending a CCIP message.
    function _buildCCIPMessage(address receiver, uint256 amount, address feeToken) private pure returns (Client.EVM2AnyMessage memory) {
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount(address(this), amount);
        return Client.EVM2AnyMessage(abi.encode(_receiver), "", tokenAmounts, Client._argsToBytes(
                    Client.EVMExtraArgsV2(0, true) // Gas limit for the ccipReceive() on destination. TODO: check what happens if this is 0 and the recipient has a ccipReceive method
                ), feeToken);
    }
}
