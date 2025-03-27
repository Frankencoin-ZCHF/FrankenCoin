// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {IERC20} from "../erc20/IERC20.sol";

abstract contract CCIPSender {

    IRouterClient public immutable ROUTER;
    address public immutable LINK;

    error InsufficientFeeTokens(address token, uint256 fee);
    error InsufficientFeeTokenAllowance(address token, uint256 fee);

    constructor(IRouterClient _router, address _link) {
        ROUTER = _router;
        LINK = _link;
    }

    function _toReceiver(address target) internal returns (bytes memory) {
        return abi.encode(target);
    }

    function _constructMessage(bytes memory _receiver, bytes memory _payload, Client.EVMTokenAmount[] memory _tokenAmounts) internal view returns (Client.EVM2AnyMessage memory) {
        return Client.EVM2AnyMessage(_receiver, _payload, _tokenAmounts, "", _guessFeeToken());
    }

    function _calculateFee(uint64 chain, Client.EVM2AnyMessage calldata message, bool nativeToken) internal returns (uint256) {
        message.feeToken = nativeToken ? address(0) : LINK;
        return ROUTER.getFee(chain, message);
    }

    /**
     * @dev External call to msg.sender if fees are paid in native token
     */
    function _send(uint64 chain, Client.EVM2AnyMessage memory _message) internal returns (bytes32 messageId, uint256 fee) {
        fee = _calculateFee(chain, _message);
        if (_message.feeToken != address(0)) {
            // We trust the feeToken to be not malicious.
            // ROUTER.getFee() verifies that the feeToken is supported by CCIP and thus vetted.
            if (IERC20(_message.feeToken).balanceOf(msg.sender) < fee) revert InsufficientFeeTokens(_message.feeToken, fee);
            if (IERC20(_message.feeToken).allowance(msg.sender, address(this)) < fee) revert InsufficientFeeTokenAllowance(_message.feeToken, fee);
            IERC20(_message.feeToken).transferFrom(msg.sender, address(this), fee);
            IERC20(_message.feeToken).approve(address(ROUTER), fee);
            messageId = ROUTER.ccipSend(chain, _message);
        } else {
            if (msg.value < fee) revert InsufficientFeeTokens(_message.feeToken, fee);
            messageId = ROUTER.ccipSend{value: fee}(chain, _message);
            payable(msg.sender).call{value: msg.value - fee}(""); // return overpaid fee to sender
        }
        // emit MessageSent(..) no necessity to emit a message, ccip does that already
    }

    function _guessFeeToken() internal view returns (address) {
        return (msg.value > 0) ? address(0) : LINK;
    }
}
