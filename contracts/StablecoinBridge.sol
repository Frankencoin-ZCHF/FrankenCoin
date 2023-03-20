// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IERC677Receiver.sol";
import "./IFrankencoin.sol";

/**
 * A minting contract for another Swiss franc stablecoin ('source stablecoin') that we trust.
 */
contract StablecoinBridge {

    IERC20 public immutable chf; // the source stablecoin
    IFrankencoin public immutable zchf; // the Frankencoin

    /**
     * The time horizon after which this bridge expires and needs to be replaced by a new contract.
     */
    uint256 public immutable horizon;

    /**
     * The maximum amount of outstanding converted source stablecoins.
     */
    uint256 public immutable limit;

    constructor(address other, address zchfAddress, uint256 limit_){
        chf = IERC20(other);
        zchf = IFrankencoin(zchfAddress);
        horizon = block.timestamp + 52 weeks;
        limit = limit_;
    }

    /**
     * Convenience method for mint(msg.sender, amount)
     */
    function mint(uint256 amount) external {
        mint(msg.sender, amount);
    }

    /**
     * Mint the target amount of Frankencoins, taking the equal amount of source coins from the sender.
     * This only works if an allowance for the source coins has been set and the caller has enough of them.
     */
    function mint(address target, uint256 amount) public {
        chf.transferFrom(msg.sender, address(this), amount);
        mintInternal(target, amount);
    }

    function mintInternal(address target, uint256 amount) internal {
        require(block.timestamp <= horizon, "expired");
        require(chf.balanceOf(address(this)) <= limit, "limit");
        zchf.mint(target, amount);
    }
    
    function burn(uint256 amount) external {
        burnInternal(msg.sender, msg.sender, amount);
    }

    /**
     * Burn the indicated amount of Frankencoin and send the same number of source coin to the caller.
     * No allowance required.
     */
    function burn(address target, uint256 amount) external {
        burnInternal(msg.sender, target, amount);
    }

    function burnInternal(address zchfHolder, address target, uint256 amount) internal {
        zchf.burn(zchfHolder, amount);
        chf.transfer(target, amount);
    }

    /**
     * Supporting the direct minting and burning through ERC-677, if supported by the sent coin.
     */
    function onTokenTransfer(address from, uint256 amount, bytes calldata) external returns (bool){
        if (msg.sender == address(chf)){
            mintInternal(from, amount);
        } else if (msg.sender == address(zchf)){
            burnInternal(address(this), from, amount);
        } else {
            require(false, "unsupported token");
        }
        return true;
    }
    
}