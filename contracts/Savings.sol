// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './utils/ERC20.sol';
import './interface/IFrankencoin.sol';
import './interface/IReserve.sol';
import './Leadrate.sol';

/**
 * @title Savings
 *
 * Module to enable savings based on a Leadrate ("Leitzins") module.
 *
 * As the interest rate changes, the speed at which 'ticks' are accumulated is
 * adjusted. The ticks counter serves as the basis for calculating the interest
 * due for the individual accoutns.
 *
 * The saved ZCHF are subject to a lockup of up to 14 days and only start to yield
 * an interest after the lockup ended. The purpose of this lockup is to discourage
 * short-term holdings and to avoid paying interest to transactional accounts.
 * Transactional accounts typically do not need an incentive to hold Frankencoins.
 */
contract Savings is Leadrate {
	uint64 public immutable INTEREST_DELAY = uint64(3 days);

	IERC20 public immutable zchf;

	mapping(address => Account) public savings;

	struct Account {
		uint192 saved;
		uint64 ticks;
	}

	event Saved(address account, uint192 amount);
	event InterestCollected(address account, uint256 interest);
	event Withdrawn(address account, uint192 amount);

	error FundsLocked(uint40 remainingSeconds);

	// The module is considered disabled if the interest is zero or about to become zero within three days.
	error ModuleDisabled();

	constructor(IFrankencoin zchf_, uint24 initialRatePPM) Leadrate(IReserve(zchf_.reserve()), initialRatePPM) {
		zchf = IERC20(zchf_);
	}

	/**
	 * Shortcut for refreshBalance(msg.sender)
	 */
	function refreshMyBalance() public returns (uint192) {
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
		if (ticks > account.ticks) {
			uint192 earnedInterest = uint192((uint256(ticks - account.ticks) * account.saved) / 1000000 / 365 days);
			if (earnedInterest > 0 && zchf.balanceOf(address(equity)) >= earnedInterest) {
				zchf.transferFrom(address(equity), address(this), earnedInterest); // collect interest as you go
				account.saved += earnedInterest;
				emit InterestCollected(accountOwner, earnedInterest);
			}
			account.ticks = ticks;
		}
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
	 * The funds sent to the account are locked for up to 14 days, depending how much
	 * already is in there.
	 */
	function save(address owner, uint192 amount) public {
		if (currentRatePPM == 0) revert ModuleDisabled();
		if (nextRatePPM == 0 && (nextChange <= block.timestamp + INTEREST_DELAY)) revert ModuleDisabled();
		Account storage balance = refresh(owner);
		zchf.transferFrom(msg.sender, address(this), amount);
		uint64 ticks = currentTicks();
		assert(balance.ticks >= ticks);
		uint256 saved = balance.saved;
		uint64 weightedAverage = uint64(
			(saved * (balance.ticks - ticks) + uint256(amount) * currentRatePPM * INTEREST_DELAY) / (saved + amount)
		);
		balance.saved += amount;
		balance.ticks = ticks + weightedAverage;
		emit Saved(owner, amount);
	}

	/**
	 * Withdraw up to 'amount' to the target address.
	 * When trying to withdraw more than available, all that is available is withdrawn.
	 * Returns the acutally transferred amount.
	 *
	 * Fails if the funds in the account have not been in the account for long enough.
	 */
	function withdraw(address target, uint192 amount) external returns (uint256) {
		Account storage account = refresh(msg.sender);
		if (account.ticks > currentTicks()) {
			revert FundsLocked(uint40(account.ticks - currentTicks() / currentRatePPM));
		} else if (amount >= account.saved) {
			amount = account.saved;
			delete savings[msg.sender];
		} else {
			account.saved -= amount;
		}
		zchf.transfer(target, amount);
		emit Withdrawn(msg.sender, amount);
		return amount;
	}
}
