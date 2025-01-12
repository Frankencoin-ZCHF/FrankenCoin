pragma solidity ^0.8.0;

import "../stablecoin/IFrankencoin.sol";
import "../equity/IReserve.sol";

/**
 * @title Bridge
 */
contract BridgeMainnet {

    IFrankencoin immutable ZCHF;
    IReserve immutable EQUITY;
    ISavings immutable SAVINGS;

    mapping (address=>uint24) bridges; // bridges must have unique addresses, even if on different chains

    event BridgeDenied(address bridge, string message);

    error TooLate();
    error InvalidSender(uint16 chainId, address bridge);

    struct Bridge {
        uint16 chainId;
        uint24 validTimestamp;
        uint216 amountSent;
    }

    constructor(IFrankencoin zchf, ISavings savings){
        ZCHF = zchf;
        EQUITY = zchf.reserve();
        SAVINGS = savings;
    }

    modifier bridgesOnly(uint16 chainId, address bridge){
        if (!isBridge(chainId, bridge)) revert InvalidSender(chainId, bridge);
        _;
    }

    function isBridge(uint16 chainId, address bridge) internal returns(bool) {
        Bridge memory bridge = bridges[bridge];
        return bridge.chainId == chainId && isValid(bridge.validTimestamp);
    }

    function isValid(uint24 timestamp) internal returns(bool) {
        return timestamp != 0 && timestamp < block.timestamp;
    }

    // To be called by method that receives messages from bridge protocol
    function receive(uint16 fromChainId, address bridge, address target, uint256 amount, uint256 transferredLoss) internal bridgesOnly(fromChainId, bridge){
        Bridge storage sender = bridges[bridge];
        ZCHF.mint(target, amount);
        if (transferredLoss > 0){
            ZCHF.coverLoss(address(this), transferredLoss);
            ZCHF.burn(transferredLoss);
        }
        sender.amountSent -= amount;
    }

    function suggestBridge(address _bridge, uint16 chainId_) external override {
        if (_applicationPeriod < MIN_) revert PeriodTooShort();
        if (bridges[_bridge] != 0) revert AlreadyRegistered();
        ZCHF.collectProfits(msg.sender, APPLICATION_FEE);
        bridges[_bridge].chainId = chainId_;
        bridges[_bridge].validTimestamp = block.timestamp + APPLICATION_PERIOD;
        emit BridgeApplied(_minter, _applicationPeriod, _applicationFee, _message);
    }

    function denyBridge(address bridge, address[] calldata _helpers, string calldata _message) external override {
        if (isValid(bridges[bridge].validTimestamp)) revert TooLate();
        EQUITY.checkQualified(msg.sender, _helpers);
        delete bridges[_minter];
        emit BridgeDenied(_minter, _message);
    }

}

interface IBridgedLeadrate {
   function updateRate(uint24 interestPPM) external;
}