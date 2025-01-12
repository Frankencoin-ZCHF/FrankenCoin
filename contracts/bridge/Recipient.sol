pragma solidity ^0.8.0;

contract Recipient {

    address public immutable BRIDGE;

    error NotBridge(address sender);

    constructor(address bridge_) {
        BRIDGE = bridge_;
    }

    modifier bridgeOnly() {
        if (msg.sender != BRIDGE) revert NotBridge(msg.sender);
        _;
    }
}