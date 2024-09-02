// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./utils/ERC20.sol";
import "./interface/IFrankencoin.sol";
import "./interface/IPosition.sol";
import "./interface/IReserve.sol";
import "./Leadrate.sol";

/**
 * @title Savings
 * 
 * Module to enable savings based on a Leadrate ("Leitzins") module.
 * 
 * As the interest rate changes, the speed at which 'ticks' are accumulated is
 * adjusted. The ticks counter serves as the basis for calculating the interest
 * due for the individual accoutns.
 */
contract Savings is Leadrate {

    IERC20 public immutable zchf;

    mapping(address => Account) public savings;

    struct Account {
        uint192 saved;
        uint64 ticks;
    }

    event Saved(address account, uint192 amount);
    event InterestReserved(uint256 interest);

    constructor(IFrankencoin zchf_) Leadrate(IReserve(zchf_.reserve()), 40000) {
        zchf = IERC20(zchf_);
    }

    /**
     * Shortcut for refreshBalance(msg.sender)
     */
    function refreshBalance() public returns (uint192) {
        return refreshBalance(msg.sender);
    }

    /**
     * Collects the accrued interest and adds it to the account.
     * 
     * It can be beneficial to do so every now and then in order to start collecting
     * interest on the accrued interest.
     */
    function refreshBalance(address owner) public returns (uint192) {
        return refresh(owner).saved;
    }

    function refresh(address accountOwner) internal returns (Account storage) {
        Account storage account = savings[accountOwner];
        uint64 ticks = currentTicks();
        uint192 earnedInterest = uint192(uint256(ticks - account.ticks) * account.saved / 1000000);
        if (earnedInterest > 0){
            zchf.transferFrom(address(equity), address(this), earnedInterest); // collect interest as you go
            account.saved += earnedInterest;
        }
        account.ticks = ticks;
        return account;
    }

    /**
     * Save 'amount'.
     */
    function save(uint192 amount) public {
        save(msg.sender, amount);
    }

    /**
     * Send 'amount' to the account of the provided owner.
     */
    function save(address owner, uint192 amount) public {
        Account storage balance = refresh(owner);
        zchf.transferFrom(msg.sender, address(this), amount);
        balance.saved += amount;
    }

    /**
     * Withdraw up to 'amount' to the target address.
     * When trying to withdraw more than available, all that is available is withdrawn.
     * Returns the acutally transferred amount.
     */
    function withdraw(address target, uint192 amount) external returns (uint256) {
        Account storage account = refresh(msg.sender);
        if (amount >= account.saved){
            amount = account.saved;
            delete savings[msg.sender];
        } else {
            account.saved -= amount;
        }
        zchf.transfer(target, amount);
        return amount;
    }

}
