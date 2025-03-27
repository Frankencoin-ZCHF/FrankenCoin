// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {IBasicFrankencoin} from "../stablecoin/IBasicFrankencoin.sol";

contract BridgeAccounting is CCIPReceiver {
    
    IBasicFrankencoin public immutable ZCHF;
    address public immutable CCIP_ADMIN;

    mapping(uint64 => bytes) public approvedSenders;

    error InvalidSender(bytes expected, bytes given);
    error NotAdmin();

    event ReceivedProfits(uint256 amount);
    event ReceivedLosses(uint256 losses);
    event SenderAdded(uint64 indexed chainSelector, bytes indexed sender);

    constructor(IBasicFrankencoin zchf, address ccipAdmin, address router) CCIPReceiver(router) {
        ZCHF = zchf;
        CCIP_ADMIN = ccipAdmin;
    }

    function addSender(uint64 _chainSelector, bytes memory _sender) external {
        if (msg.sender != CCIP_ADMIN) revert NotAdmin();
        approvedSenders[_chainSelector] = _sender;

        emit SenderAdded(_chainSelector, _sender);
    }

    function _ccipReceive(Client.Any2EVMMessage memory any2EvmMessage) internal override {
        _validateSender(any2EvmMessage);

        (uint256 profits, uint256 losses) = abi.decode(any2EvmMessage.data, (uint256, uint256));
        if (profits > 0) {
            _handleProfits();
        }

        if (losses > 0) {
            _handleLosses(losses);
        }
    }

    function _validateSender(Client.Any2EVMMessage memory any2EvmMessage) internal view {
        bytes memory approvedSender = approvedSenders[any2EvmMessage.sourceChainSelector];
        if (keccak256(any2EvmMessage.sender) != keccak256(approvedSender)) {
            revert InvalidSender(approvedSender, any2EvmMessage.sender);
        }
    }

    function _handleProfits() internal {
        // Use total balance to remove dust
        uint256 balance = ZCHF.balanceOf(address(this));
        ZCHF.collectProfits(address(this), balance);
        emit ReceivedProfits(balance);
    }

    function _handleLosses(uint256 amount) internal {
        ZCHF.coverLoss(address(this), amount); // to trigger the Loss event
        ZCHF.burn(amount);
        emit ReceivedLosses(amount);
    }
}
