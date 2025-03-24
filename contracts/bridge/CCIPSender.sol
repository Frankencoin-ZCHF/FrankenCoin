// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {IERC20} from "../erc20/IERC20.sol";

abstract contract CCIPSender {
    IRouterClient public immutable ROUTER;

    event CCIPMessageSent(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        uint256 fee,
        Client.EVM2AnyMessage message
    );

    constructor(IRouterClient _router) {
        ROUTER = _router;
    }

    function _getCCIPMessage(
        bytes calldata _receiver,
        address _feeTokenAddress,
        bytes memory _payload,
        Client.EVMTokenAmount[] memory _tokenAmounts,
        bytes calldata _extraArgs
    ) internal pure returns (Client.EVM2AnyMessage memory) {
        return
            Client.EVM2AnyMessage({
                receiver: _receiver,
                data: _payload,
                tokenAmounts: _tokenAmounts,
                extraArgs: _extraArgs,
                feeToken: _feeTokenAddress
            });
    }

    function _getCCIPFee(
        uint64 _destinationChainSelector,
        bytes calldata _receiver,
        address _feeTokenAddress,
        bytes memory _payload,
        Client.EVMTokenAmount[] memory _tokenAmounts,
        bytes calldata _extraArgs
    ) internal view returns (uint256) {
        Client.EVM2AnyMessage memory message = _getCCIPMessage(
            _receiver,
            _feeTokenAddress,
            _payload,
            _tokenAmounts,
            _extraArgs
        );
        return ROUTER.getFee(_destinationChainSelector, message);
    }

    /**
     * @dev External call to msg.sender if fees are paid in native token
     */
    function _ccipSend(
        uint64 _destinationChainSelector,
        Client.EVM2AnyMessage memory _message
    ) internal returns (bytes32 messageId, uint256 fee) {
        fee = ROUTER.getFee(_destinationChainSelector, _message);

        if (_message.feeToken != address(0)) {
            // We trust the feeToken to be not malicious.
            // ROUTER.getFee() verifies that the feeToken is supported by CCIP and thus vetted.
            IERC20(_message.feeToken).transferFrom(msg.sender, address(this), fee);
            IERC20(_message.feeToken).approve(address(ROUTER), fee);
            messageId = ROUTER.ccipSend(_destinationChainSelector, _message);
        } else {
            messageId = ROUTER.ccipSend{value: fee}(_destinationChainSelector, _message);
            // return overpaid fee to sender
            payable(msg.sender).call{value: msg.value - fee}("");
        }

        emit CCIPMessageSent(messageId, _destinationChainSelector, fee, _message);
    }
}
