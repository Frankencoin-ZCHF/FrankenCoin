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

    uint256 public constant MIN_CHALLENGE = 100 * 10**18;

    uint256 public constant CHALLENGE_PERIOD = 7 days;

    IERC20 immutable collateral;
    IFrankencoin immutable zchf;
    IReservePool immutable reserve;

    bool private initialized;
    uint32 public challengeCount;
    uint32 public closedChallenges;
    uint256 public coolDownEnd; // cool down after averted challenges

    uint256 public minted; // excluding the reserve contribution
    uint256 public mintingLimit; // excluding the reserve contribution
    uint256 public depositedCollateral;

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
        reserve = IReservePool(zchf.reserve());
    }

    function initialize(uint256 _mintingLimit, uint256 _collateralAmount, uint256 period, uint256 fee) public {
        require(!initialized);
        initialized = true;
        mintingLimit = _mintingLimit;
        depositedCollateral = _collateralAmount;
        collateral.transferFrom(msg.sender, address(this), _collateralAmount);
        zchf.suggestMinter(address(this), period, fee);
        reserve.delegateVoteTo(msg.sender);
    }

    function mint(address target) public {
        uint256 amount = mintingLimit; // todo: be more flexible
        require(minted + amount <= mintingLimit);
        uint256 capitalReserve = amount * (COLLATERALIZATION - BASE) / BASE; // 25% of the minted amount
        zchf.mint(target, amount, 0);
        zchf.mintAndCall(address(reserve), capitalReserve, capitalReserve);
        minted += amount;
    }

    function payback() external noChallenge {
        uint256 amount = mintingLimit; // todo: be more flexible
        zchf.transferFrom(msg.sender, address(this), amount);
        processPayback(amount);
    }

    // return Frankencoins without reducing collateral
    function onTokenTransfer(address from, uint256 returnedCurrency, bytes calldata data) external noChallenge returns (bool) {
        require(msg.sender == address(zchf));
        require(returnedCurrency == mintingLimit);
        processPayback(returnedCurrency);
        return true;
    }

    function processPayback(uint256 returnedCurrency) internal {
        uint256 poolshare = reserve.redeemableBalance(address(this));
        uint256 mintedIncludingReserve = minted * COLLATERALIZATION / BASE;
        if (poolshare >= mintedIncludingReserve) {
            // our pool share has become so valuable that the loan has paid for itself, return everything
            reserve.redeem(reserve.balanceOf(address(this)));
            zchf.burn(address(this), mintedIncludingReserve, mintedIncludingReserve - minted);
            zchf.transfer(owner, returnedCurrency + poolshare - mintedIncludingReserve);
            minted = 0;
        } else {
            uint256 fundsToRepay = mintedIncludingReserve - poolshare; // that's how much the minter must pay to close the position
            if (returnedCurrency > fundsToRepay){
                zchf.transfer(owner, returnedCurrency - fundsToRepay);
                returnedCurrency = fundsToRepay;
            }
            reserve.redeem(reserve.balanceOf(address(this)) * returnedCurrency / fundsToRepay);
            uint256 burnAmount = mintedIncludingReserve * returnedCurrency / fundsToRepay;
            uint256 reserveAmount = burnAmount  * (COLLATERALIZATION - BASE) / COLLATERALIZATION;
            zchf.burn(address(this), burnAmount, reserveAmount);
            minted -= minted * returnedCurrency / fundsToRepay;
        }
    }

    function withdrawCollateral(address target, uint256 amount) onlyOwner public noChallenge {
        internalWithdrawCollateral(target, amount);
    }

    function internalWithdrawCollateral(address target, uint256 amount) internal {
        uint256 freeCollateral = (depositedCollateral * (mintingLimit - minted)) / mintingLimit;
        require(amount <= freeCollateral);
        collateral.transfer(target, amount);
        mintingLimit -= mintingLimit * amount / depositedCollateral;
        depositedCollateral -= amount;
        require(minted <= mintingLimit);
    }

    modifier noChallenge(){
        require(closedChallenges == challengeCount && block.timestamp > coolDownEnd);
        _;
    }

    function launchChallenge(uint256 challengeSize) external returns (uint32) {
        require(challengeSize >= MIN_CHALLENGE);
        collateral.transferFrom(msg.sender, address(this), challengeSize);
        uint32 number = challengeCount++;
        challenges[number] = Challenge(msg.sender, challengeSize, block.timestamp + CHALLENGE_PERIOD, address(0x0), 0);
        return number;
    }

    function bid(uint32 challengeNumber, uint256 amount) external {
        Challenge memory challenge = challenges[challengeNumber];
        require(block.timestamp < challenge.end);
        require(amount > challenge.bid);
        if (challenge.bid > 0){
            zchf.transfer(challenge.bidder, challenge.bid); // return old bid
        }
        if (amount * depositedCollateral >= mintingLimit * COLLATERALIZATION / BASE * challenge.size){
            // bid above Z_B/C_C >= (1+h)Z_M/C_M, challenge averted, end immediately
            zchf.transferFrom(msg.sender, challenge.challenger, amount);
            collateral.transfer(msg.sender, challenge.size);
            closedChallenges++;
            coolDownEnd = block.timestamp + 1 days;
            delete challenges[challengeNumber];
        } else {
            zchf.transferFrom(msg.sender, address(this), amount);
            challenge.bid = amount;
            challenge.bidder = msg.sender;
        }
    }

    function end(uint32 challengeNumber) external {
        Challenge storage challenge = challenges[challengeNumber];
        require(block.timestamp >= challenge.end);
        // challenge must have been successful, because otherwise it would have immediately ended on placing the winning bid
        uint256 challengedCollateral = challenge.size >= depositedCollateral ? depositedCollateral : challenge.size;
        uint256 challengedMintings = mintingLimit * challengedCollateral / depositedCollateral;
        uint256 challengerReward = CHALLENGER_REWARD * challengedMintings / BASE;
        collateral.transfer(challenge.challenger, challenge.size); // return the challenger's collateral
        collateral.transfer(challenge.bidder, challenge.size); // bidder gets collateral of owner
        depositedCollateral -= challenge.size;
        if (challengerReward >= challenge.bid) {
            // pay out the reward
            zchf.transfer(challenge.challenger, challengerReward);
        } else {
            // highest bid was lower than challenger reward, this is an
            // edge case, solved slightly differently than in paper
            zchf.transfer(challenge.challenger, challenge.bid);
        }
        uint256 moneyLeft = challenge.bid - challengerReward;
        if (minted == 0){
            // nothing minted yet, return rest of the collateral
            collateral.transfer(owner, depositedCollateral);
            if (moneyLeft > challengedMintings){
                zchf.transfer(owner, challengedMintings);
                zchf.transfer(address(reserve), moneyLeft - challengedMintings);
            } else {
                zchf.transfer(owner, moneyLeft);
            }
            mintingLimit = 0;
            depositedCollateral = 0;
        } else {
            uint256 amountToBurn = challengedMintings * COLLATERALIZATION / BASE;
            if (moneyLeft >= amountToBurn){
                zchf.transfer(address(reserve), moneyLeft - amountToBurn);
            } else {
                zchf.notifyLoss(amountToBurn - moneyLeft);
            }
            zchf.burn(address(this), amountToBurn, amountToBurn - challengedMintings);
        }
        closedChallenges++;
        delete challenges[challengeNumber];
    }

}