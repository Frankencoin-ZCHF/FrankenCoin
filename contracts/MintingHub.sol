// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IReservePool.sol";
import "./IFrankencoin.sol";
import "./Ownable.sol";
import "./Position.sol";

/**
 * A hub for creating collateralized minting positions for a given collateral.
 */
contract MintingHub {

    uint256 public constant OPENING_FEE = 1000*10**18;
    
    uint32 public constant BASE = 1000000;
    uint32 public constant CHALLENGER_REWARD = 20000; // 2% 

    uint256 public constant CHALLENGE_PERIOD = 7 days;

    IFrankencoin public immutable zchf; // currency
    uint32 public challengeCount;
    mapping (uint32 => Challenge) private challenges;
    
    struct Challenge {
        address challenger;
        Position position;
        uint256 size;
        uint256 end;
        address bidder;
        uint256 bid;
    }

    event ChallengeStarted(address indexed challenger, address position, uint256 size, uint32 number);
    event ChallengeAverted(uint32 number);
    event ChallengeSucceeded(uint32 number);

    constructor(address _zchf) {
        zchf = IFrankencoin(_zchf);
    }

    function openPosition(address collateral, uint256 initialCollateral, uint256 initialLimit, uint256 duration, uint32 fees, uint32 reserve) public returns (address) {
        Position pos = new Position(msg.sender, address(zchf), collateral, initialCollateral, initialLimit, duration, fees, reserve);
        zchf.registerPosition(address(pos));
        zchf.transferFrom(msg.sender, zchf.reserve(), OPENING_FEE);
        IERC20(collateral).transferFrom(msg.sender, address(pos), initialCollateral);
        return address(pos);
    }

    function launchChallenge(Position position, uint256 size) external returns (uint32) {
        require(size >= position.minChallenge());
        IERC20(position.collateral()).transferFrom(msg.sender, address(this), size);
        uint32 number = challengeCount++;
        challenges[number] = Challenge(msg.sender, position, size, block.timestamp + CHALLENGE_PERIOD, address(0x0), 0);
        position.notifyChallengeStarted();
        emit ChallengeStarted(msg.sender, address(position), size, number);
        return number;
    }

    function bid(uint32 challengeNumber, uint256 amount) external {
        Challenge memory challenge = challenges[challengeNumber];
        require(block.timestamp < challenge.end);
        require(amount > challenge.bid);
        if (challenge.bid > 0){
            zchf.transfer(challenge.bidder, challenge.bid); // return old bid
        }
        if (challenge.position.tryAvertChallenge(challenge.size, amount)){
            // bid above Z_B/C_C >= (1+h)Z_M/C_M, challenge averted, end immediately by selling challenger collateral to bidder
            zchf.transferFrom(msg.sender, challenge.challenger, amount);
            IERC20(Position(challenge.position).collateral()).transfer(msg.sender, challenge.size);
            emit ChallengeAverted(challengeNumber);
            delete challenges[challengeNumber];
        } else {
            zchf.transferFrom(msg.sender, address(this), amount);
            challenge.bid = amount;
            challenge.bidder = msg.sender;
        }
    }

    /**
     * Ends a challenge successfully after the auction period ended.
     *
     * Example: A challenged position had 1000 ABC tokens as collateral with a minting limit of 200,000 ZCHF, out
     * of which 60,000 have been minted and thereof 15,000 used to buy reserve tokens. The challenger auctioned off
     * 400 ABC tokens, challengind 40% of the position. The highest bid was 75,000 ZCHF, below the
     * 40% * 200,000 = 80,000 ZCHF needed to avert the challenge. The reserve ration of the position is 25%.
     * 
     * Now, the following happens when calling this method:
     * - 400 ABC from the position owner are transferred to the bidder
     * - The challenger's 400 ABC are returned to the challenger
     * - 40% of the reserve bought with the 15,000 ZCHF is sold off (approximately), yielding e.g. 5,600 ZCHF
     * - 40% * 60,000 = 24,000 ZCHF are burned
     * - 80,000 * 2% = 1600 ZCHF are given to the challenger as a reward
     * - 40% * (100%-25%) * (200,000 - 60,000) = 42,000 are given to the position owner for selling off unused collateral
     * - The remaining 75,000 + 5,600 - 1,600 - 24,000 - 42,000 = 13,000 ZCHF are sent to the reserve pool
     *
     * If the highest bid was only 60,000 ZCHF, then we would have had a shortfall of 2,000 ZCHF that would in the
     * first priority be covered by the reserve and in the second priority by minting unbacked ZCHF, triggering a 
     * balance alert.
     */
    function end(uint32 challengeNumber) external {
        Challenge storage challenge = challenges[challengeNumber];
        IERC20 collateral = challenge.position.collateral();
        require(block.timestamp >= challenge.end);
        // challenge must have been successful, because otherwise it would have immediately ended on placing the winning bid
        collateral.transfer(challenge.challenger, challenge.size); // return the challenger's collateral
        checkSize(challenge, collateral); // ensure challenge is not larger than available collateral
        (uint256 repay, uint256 minted, uint256 mintmax) = challenge.position.notifyChallengeSucceeded(challenge.bidder, challenge.size);
        uint256 reward = mintmax * CHALLENGER_REWARD / BASE;
        uint256 moneyNeeded = repay + (mintmax - minted) + reward;
        if (moneyNeeded > challenge.bid){
            // we have a problem, the bid was not high enough to cover all the costs
            zchf.notifyLoss(moneyNeeded - challenge.bid);
        } else if (moneyNeeded < challenge.bid){
            // we are lucky, there is some excess money that we can put into the reserve
            zchf.transfer(zchf.reserve(), challenge.bid - moneyNeeded);
        }
        zchf.transfer(challenge.challenger, reward); // pay out the challenger reward
        zchf.transferAndCall(address(challenge.position), repay, new bytes(0)); // Repay the challenged and used part of the position and burn the tokens
        zchf.transfer(address(challenge.position), challenge.position.getUsableMint(mintmax - minted, true)); // Give owner fair share of auction proceeds from selling off unused collateral
        emit ChallengeSucceeded(challengeNumber);
        delete challenges[challengeNumber];
    }

    function checkSize(Challenge memory challenge, IERC20 collateral) internal {
        uint256 totalCollateral = collateral.balanceOf(address(challenge.position));
        if (challenge.size > totalCollateral){ // overbid, return excess amount
            uint256 betterBid = challenge.bid * totalCollateral / challenge.size;
            IERC20(zchf).transfer(challenge.bidder, challenge.bid - betterBid);
            challenge.size = totalCollateral;
            challenge.bid = betterBid;
        }
    }

}