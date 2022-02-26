// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IFrankencoin.sol";

/**
 * A simple collateralized minting contract.
 * This is a proof of concept that only allows one challenge at a time
 * and does not support fractional challenges.
 */
contract CollateralizedMinter {

    uint32 public constant CAPITAL_RATIO = 250000; // 25%
    uint32 public constant COLLATERALIZATION = 1100000; // 110% 
    uint32 public constant CHALLENGER_REWARD = 20000; // 2% 

    uint256 public constant CHALLENGE_PERIOD = 3 days;

    IERC20 immutable collateral;
    IFrankencoin immutable zchf;
    address immutable brain;
    address immutable owner;

    uint256 public minted;
    uint256 public mintingLimit;
    uint256 public collateralLimit;

    address public challenger;
    uint256 public challengeEnd;
    address public highestBidder;
    uint256 public highestBid;

    constructor(address zchfAddress, address collateralAddress){
        collateral = IERC20(collateralAddress);
        zchf = IFrankencoin(zchfAddress);
        brain = zchf.brain();
        owner = msg.sender;
    }

    // Reapply for new minting license whenever implied price changes
    // (Differs from solution described in paper)
    // Note: this not work, collateral must be present for challenge to function
    function pushlimit(uint256 maxMinting, uint256 maxCollateral) external {
        require(msg.sender == owner);
        // the two limits imply a price
        mintingLimit = maxMinting;
        collateralLimit = maxCollateral;
        zchf.suggestMinter(address(this)); // suspend minting until approved again
    }

    /**
     * Send collateral to mint more.
     * Send ZCHF to get collateral back.
     */
    function onTokenTransfer(address from, uint256 amount, bytes calldata) external returns (bool){
        require(challenger == address(0x0)); // cannot mint or burn while being challenged
        if (msg.sender == address(collateral)) {
            uint256 currentCollateral = collateral.balanceOf(address(this));
            uint256 maxMintable = currentCollateral * mintingLimit / collateralLimit;
            if (maxMintable > minted){
                zchf.mint(from, maxMintable - minted, CAPITAL_RATIO);
                minted = maxMintable;
            }
            require(minted <= mintingLimit);
        } else {
            require(msg.sender == address(zchf));
            zchf.burn(msg.sender, amount, CAPITAL_RATIO);
            minted -= amount;

            uint256 requiredCollateral = minted * collateralLimit / mintingLimit;
            uint256 actualCollateral = collateral.balanceOf(address(this));
            if (actualCollateral > requiredCollateral){
                collateral.transfer(from, actualCollateral - requiredCollateral);
            }
        }
        return true;
    }

    function challenge() external {
        require(challenger == address(0x0)); // cannot challenge while other challenge ongoing
        uint256 collateralAmount = zchf.balanceOf(address(this));
        collateral.transferFrom(msg.sender, address(this), collateralAmount);
        challengeEnd = block.timestamp + CHALLENGE_PERIOD;
    }

    function bid(uint256 amount) external {
        require(challenger != address(0x0));
        require(amount > highestBid);
        require(block.timestamp < challengeEnd);
        zchf.transfer(highestBidder, highestBid); // return old bid
        zchf.transferFrom(msg.sender, address(this), amount);
        highestBid = amount;
        highestBidder = msg.sender;
    }

    function endChallenge() external {
        require(block.timestamp >= challengeEnd);
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