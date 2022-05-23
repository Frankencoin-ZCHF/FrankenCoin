// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IReservePool.sol";
import "./IFrankencoin.sol";
import "./Ownable.sol";
import "./IERC677Receiver.sol";

/**
 * A simple collateralized minting contract.
 * This is a proof of concept that only allows one challenge at a time
 * and does not support fractional challenges.
 */
contract CollateralizedMinter is Ownable, IERC677Receiver {

    uint32 public constant BASE = 1000000;
    uint32 public constant COLLATERALIZATION = 1250000; // 125% 
    uint32 public constant CHALLENGER_REWARD = 20000; // 2% 

    uint256 public constant CHALLENGE_PERIOD = 7 days;

    IERC20 immutable collateral;
    IFrankencoin immutable zchf;
    IReservePool immutable reserve;

    uint32 challengeCount;
    uint32 closedChallenges;

    uint256 public mintable;
    
    uint256 public minted;

    mapping (uint32 => Challenge) private challenges;

    struct Challenge {
        address challenger;
        uint256 size;
        uint256 end;
        address bidder;
        uint256 bid;
    }

    constructor(address zchfAddress, address collateralAddress) Ownable(msg.sender) {
        collateral = IERC20(collateralAddress);
        zchf = IFrankencoin(zchfAddress);
        reserve = zchf.brain();
    }

    function initialize(uint256 _mintingLimit, uint256 _collateralAmount, uint256 period, uint256 fee) {
        mintingLimit = _mintingLimit;
        collateralLimit = _collateralLimit;
        collateral.transferFrom(msg.sender, address(this), _collateralAmount);
        zchf.suggestMinter(address(this), period, fee);
        reserve.delegateVoteTo(msg.sender);
    }

    function onTokenTransfer(address from, uint256 amount, bytes calldata data) external returns (bool) {
        require(msg.sender == address(zchf));
        close(from, amount);
    }

    function mint(address target) public {
        uint256 currentCollateral = collateral.balanceOf(address(this));
        require(currentCollateral <= collateralLimit, "too much collateral");
        uint256 mintable = currentCollateral * mintingLimit / collateralLimit - minted;
        require(mintable >= 0, "no additional collateral found");
        uint256 capitalReserve = mintable * (COLLATERALIZATION - BASE) / BASE; // 25% of the minted amount
        zchf.mint(target, mintable, 0);
        zchf.mintAndCall(reserve, capitalReserve, capitalReserve);
        minted += mintable + capitalReserve;
    }

    function close(address target, uint256 amount) onlyOwner public {
        uint256 returnedCurrency = zchf.balanceOf(address(this));
        uint256 poolshare = reserve.redeemableBalance(address(this));
        uint256 fundsToRepay = minted - poolshare; // that's how much the minter must pay to close the position
        if (returnedCurrency > fundsToRepay){
            returnedCurrency = fundsToRepay;
        }
        collateral.transfer(msg.sender, collateral.balanceOf(address(this)) * returnedCurrency / fundsToRepay);
        uint256 burnAmount = minted * returnedCurrency / fundsToRepay;
        minted -= burnAmount;
        zchf.burn(address(this), burnAmount, burnAmount  * (COLLATERALIZATION - BASE) / BASE);
        uint256 remainingBalance = zchf.balanceOf(address(this));
        if (remainingBalance > 0){
            // in case more than necessary to close the position fully was sent to us
            zchf.transfer(target, remainingBalance);
        }
    }

    function challenge(uint256 challengeSize) external returns (uint32) {
        collateral.transferFrom(msg.sender, address(this), challengeSize);
        uint32 number = challengeCount++;
        challenges[number] = Challenge(msg.sender, challengeSize, block.timestamp + CHALLENGE_PERIOD, address(0x0), 0);
        return number;
    }

    function bid(uint32 challengeNumber, uint256 amount) external {
        Challenge challenge = challenges[challengeNumber];
        require(block.timestamp < challenge.end);
        require(amount > challenge.bid);
        if (challenge.bid > 0){
            zchf.transfer(challenge.bidder, challenge.bid); // return old bid
        }
        if (amount * collateralLimit >= mintingLimit * COLLATERALIZATION / BASE * challenge.size){
            // bid above Z_B/C_C >= (1+h)Z_M/C_M, challenge averted, end immediately
            zchf.transferFrom(msg.sender, challenge.challenger, amount);
            collateral.transfer(msg.sender, challenge.size);
            closedChallenges++;
            delete challenges[challengeNumber];
        } else {
            zchf.transferFrom(msg.sender, address(this), amount);
            challenge.bid = amount;
            challenge.bidder = msg.sender;
        }
    }

    function end(uint32 challengeNumber) external {
        Challenge challenge = challenges[challengeNumber];
        require(block.timestamp >= challenge.end);
        // challenge must have been successful, because otherwise it would have immediately ended on placing the winning bid
        collateral.transfer(challenge.challenger, challenge.size); // return the challenger's collateral
        uint256 challengeSize = challenge.size < collateral.balanceOf(address(this));
        uint256 challengedAmount = minted * challenge.size 
        if (challenge.bid > 0){
            collateral.transfer(challenge.bidder, challenge.size);
            zchf.transfer(challenge.challenger, highestBid);
        }
        closedChallenges++;
        delete challenges[challengeNumber];
    }



        uint256 necessaryValue = COLLATERALIZATION * minted  / 1000000;
        uint256 balance = collateral.balanceOf(address(this));
        uint256 collateralAmount = balance / 2; // half of all collateral came from challenger, half from minter
        if (highestBid >= necessaryValue){
            // we are safe, challenge failed, someone bid enough, challenger sells challenge amount to highest bidder
            collateral.transfer(highestBidder, collateralAmount);
            zchf.transfer(challenger, highestBid);
        } else {
            // challenger wins, bidder gets collateral of owner, challenger gets collateral back
            collateral.transfer(highestBidder, collateralAmount);
            collateral.transfer(challenger, balance - collateralAmount);

            // pay out reward to challenger
            uint256 challengerReward = CHALLENGER_REWARD * minted / 1000000;
            if (challengerReward >= highestBid){
                zchf.transfer(challenger, challengerReward);
            } else {
                // highest bid was lower than challenger reward, this is an
                // edge case, solved slightly differently than in paper
                zchf.transfer(challenger, highestBid);
            }

            // bring money supply back into balance
            uint256 moneyLeft = zchf.balanceOf(address(this));
            if (moneyLeft >= minted){
                zchf.burn(msg.sender, minted, CAPITAL_RATIO); // return minted tokens
                zchf.transfer(brain, moneyLeft - minted); // send surplus to governance contract
            } else {
                zchf.burn(msg.sender, moneyLeft, CAPITAL_RATIO); // return as much as we can
                zchf.notifyLoss(minted - moneyLeft, CAPITAL_RATIO); // notify Frankencoin about loss
            }
            minted = 0;
        }
        challenger = address(0x0);
    }

}