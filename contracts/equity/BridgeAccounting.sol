// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {ITokenAdminRegistry} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/ITokenAdminRegistry.sol";
import {TokenPool} from "@chainlink/contracts-ccip/src/v0.8/ccip/pools/TokenPool.sol";
import {IBasicFrankencoin} from "../stablecoin/IBasicFrankencoin.sol";

contract BridgeAccounting is CCIPReceiver {
    IBasicFrankencoin public immutable ZCHF;
    ITokenAdminRegistry public immutable TOKEN_ADMIN_REGISTRY;

    event ReceivedProfits(uint256 amount);
    event ReceivedLosses(uint256 losses);
    event SenderAdded(uint64 indexed chain, bytes indexed sender);

    error InvalidSender(uint64 chain, bytes sender);

    constructor(IBasicFrankencoin zchf, ITokenAdminRegistry _registry, address router) CCIPReceiver(router) {
        ZCHF = zchf;
        TOKEN_ADMIN_REGISTRY = _registry;
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
        TokenPool pool = TokenPool(TOKEN_ADMIN_REGISTRY.getPool(address(ZCHF)));
        bytes memory expectedSender = pool.getRemoteToken(any2EvmMessage.sourceChainSelector);
        if (keccak256(any2EvmMessage.sender) != keccak256(expectedSender)) {
            revert InvalidSender(any2EvmMessage.sourceChainSelector, any2EvmMessage.sender);
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
        // the BridgedFrankencoin already minted new tokens and made the minter whole.
        // the tokens minted by the main Frankencoin are therefore a duplicate and need to be burned
        // otherwise a loss would have double the impact
        ZCHF.burn(amount); 
        emit ReceivedLosses(amount);
    }
}
