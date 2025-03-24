pragma solidity ^0.8.0;


contract BridgeAccounting {

    // ZCHF
    // CCIPADMIN
    // EQUITY

    constructor(address zchf, address ccipAdmin){

    }

    function receiveProfits(uint256 amount) external {
        // check with ccip admin if sender is valid token contract of other chain
        // from router, assume tokens have already been transferred
        ZCHF.collectProfits(address(this), amount);
    }

    function receiveLosses(uint256 amount) external {
        // check with ccip admin if sender is valid token contract of other chain
        ZCHF.coverLoss(amount); // to trigger the Loss event
        ZCHF.burn(amount);
    }

}