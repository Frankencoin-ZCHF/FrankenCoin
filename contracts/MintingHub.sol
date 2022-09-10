// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IReservePool.sol";
import "./IFrankencoin.sol";
import "./Ownable.sol";
import "./IPosition.sol";

/**
 * A hub for creating collateralized minting positions for a given collateral.
 */
contract MintingHub {

    uint256 public constant OPENING_FEE = 1000*10**18;
    
    uint32 public constant BASE = 1000000;
    uint32 public constant CHALLENGER_REWARD = 20000; // 2% 

    uint256 public constant CHALLENGE_PERIOD = 7 days;

    IPositionFactory private immutable POSITION_FACTORY; // position contract to clone

    IFrankencoin public immutable zchf; // currency
    Challenge[] public challenges;
    
    struct Challenge {
        address challenger;
        IPosition position;
        uint256 size;
        uint256 end;
        address bidder;
        uint256 bid;
    }

    event ChallengeStarted(address indexed challenger, address position, uint256 size, uint32 number);
    event ChallengeAverted(uint32 number);
    event ChallengeSucceeded(uint32 number);

    constructor(address _zchf, address posFactoy) {
        zchf = IFrankencoin(_zchf);
        POSITION_FACTORY = IPositionFactory(posFactoy);
    }

     /**
     * @notice open a collateralized loan position
     * @param _collateral        address of collateral token
     * @param _initialCollateral amount of initial collateral to be deposited
     * @param _initialLimit      maximal amount of ZCHF that can be minted by the position owner 
     * @param _duration          maturity of the loan in unit of timestamp (seconds)
     * @param _fees              percentage minting fee that will be added to reserve,
     *                          basis 1000_000
     * @param _reserve           percentage reserve amount that is added as the 
     *                          borrower's stake into reserve, basis 1000_000
     * @return address of resulting position
     */
    function openPosition(address _collateral, uint256 _initialCollateral, uint256 _initialLimit, 
        uint256 _duration, uint32 _fees, uint32 _reserve) public returns (address) {
        IPosition pos = POSITION_FACTORY.create(msg.sender, address(zchf), h, _initialCollateral, _initialLimit, _duration, _fees, _reserve);
        zchf.registerPosition(address(pos));
        zchf.transferFrom(msg.sender, zchf.reserve(), OPENING_FEE);
        IERC20(_collateral).transferFrom(msg.sender, address(pos), _initialCollateral);
        return address(pos);
    }

    function clonePosition(address position, uint256 _initialCollateral, uint256 _initialMint) public returns (address) {
        require(zchf.isPosition(position) == address(this), "not our pos");
        IPosition pos = POSITION_FACTORY.clone(position, msg.sender, _initialCollateral, _initialMint);
        IERC20(pos.collateral()).transferFrom(msg.sender, address(pos), _initialCollateral);
        zchf.registerPosition(address(pos));
        zchf.transferFrom(msg.sender, zchf.reserve(), OPENING_FEE);
        return address(pos);
    }

    function reserve() external view returns (IReservePool) {
        return IReservePool(zchf.reserve());
    }

    function launchChallenge(IPosition position, uint256 size) external returns (uint32) {
        IERC20(position.collateral()).transferFrom(msg.sender, address(this), size);
        uint32 pos = challenges.size;
        challenges.push(Challenge(msg.sender, position, size, block.timestamp + CHALLENGE_PERIOD, address(0x0), 0));
        position.notifyChallengeStarted(size);
        emit ChallengeStarted(msg.sender, address(position), size, pos);
        return pos;
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
            IERC20(challenge.position.collateral()).transfer(msg.sender, challenge.size);
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
        // notify the position that will send the collateral to the bidder. If there is no bid, send the collateral to msg.sender
        address recipient = challenge.bidder == address(0x0) ? msg.sender : challenge.bidder;
        (uint256 effectiveBid, uint256 volume, uint32 reservePPM) = challenge.position.notifyChallengeSucceeded(challenge.bidder, challenge.bid, challenge.size);

        if (effectiveBid < challenge.bid){ // overbid, return excess amount
            IERC20(zchf).transfer(challenge.bidder, challenge.bid - effectiveBid);
        }
        uint256 reward = volume * CHALLENGER_REWARD / BASE;
        zchf.notifyLoss(reward + volume - effectiveBid); // ensure we have enough to pay everything
        zchf.transfer(challenge.challenger, reward); // pay out the challenger reward
        zchf.burnWithReserve(volume, reservePPM); // Repay the challenged part
        emit ChallengeSucceeded(challengeNumber);
        delete challenges[challengeNumber];
    }

}