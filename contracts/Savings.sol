// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interface/IERC20.sol";
import "./interface/IFrankencoin.sol";
import "./interface/IPosition.sol";
import "./interface/IReserve.sol";

/**
 * @title Savings
 * 
 * Module to enable savings.
 * 
 * When saving Frankencoins, a maturity date must be chosen, depending on which the interest
 * is caluclated such that the system can be sure to not pay out more than it already received
 * on the other side of the balance sheet. Savers that go in first generally have an advantage.
 * The higher the total savings, the lower the interest. Also, those who choose a short
 * duration have an advantage. This is economically unfortunate, but it is necessary to 
 * fulfill the requirement of always being sure that more interest comes in than goes out.
 * 
 */
contract Savings {

    IFrankencoin public immutable zchf;
    address public immutable legacyHub;
    address public immutable equity;

    uint256 public totalSaved;

    mapping(uint256 => Account) public accounts;

    struct Account {
        uint192 amount;
        uint64 end;
    }

    error InsufficientVolume();
    error InvalidPosition(address pos);
    error AccountAlive(uint256 account);

    event Saved(address account, uint32 id, uint256 amount, uint32 interest, uint64 maturity);
    event InterestExtracted(uint192 interest);
    event Cleanup(address account, uint32 id);
    event BoostProposed(address boost);

    constructor(IFrankencoin zchf_, address legacyHub_){
        zchf = zchf_;
        legacyHub = legacyHub_;
        equity = address(zchf_.reserve());
    }

    /**
     * Save the target amount under the given account id for a fixed duration.
     * Optionally provide a number of accounts that should be cleaned up in order to potentially get a better interest rate.
     * List of positions and legacy positions must be in 
     */
    function save(uint192 amount, uint32 id, uint32 yield, uint64 maturity, uint256[] calldata cleanupIds, address[] calldata interestProof, address[] calldata legacyPositions) external {
        for (uint256 i=0; i<cleanupIds.length; i++){
            cleanup(cleanupIds[i]);
        }
        if (!isFeasible(interestProof, legacyPositions, amount, maturity, yield)) revert InsufficientVolume();
        uint192 interest = calculateInterest(amount, yield, maturity);
        zchf.transferFrom(msg.sender, address(this), amount);
        zchf.transferFrom(equity, address(this), interest);
        accounts[getAccountId(msg.sender, id)] = Account(amount + interest, maturity);
        emit Saved(msg.sender, id, amount, yield, maturity);
        emit InterestExtracted(interest);
    }

    function calculateInterest(uint192 amount, uint32 rate, uint64 maturity) internal view returns (uint192){
        return uint192(uint256(amount) * rate * (maturity - block.timestamp) / 1000000 / 365 days);
    }
    
    /**
     * Very inefficient method to find the yield at a specific point in the two dimensional yield surface with
     * volume and expiration as x and y coordinates, given all relevant positions.
     */
    function yieldAt(address[] calldata interestProof, address[] calldata legacyPositions, uint256 volume, uint64 expiration) external view returns (uint32) {
        return findBestYield(interestProof, legacyPositions, volume, expiration);
    }

    /**
     * Very inefficient function to find the yield curve for a specific savings volume.
     * It can be used to figure out what interest can be achieved for a given savings volume when varying the maturity.
     */
    function yieldCurve(address[] calldata interestProof, address[] calldata legacyPositions, uint256 volume) public view returns (uint32[] memory, uint64[] memory) {
        uint256 totVolume = totalSaved + volume;
        uint64 nextExpiration = uint64(block.timestamp);
        uint32[] memory yields = new uint32[](interestProof.length + legacyPositions.length);
        uint64[] memory durations = new uint64[](interestProof.length + legacyPositions.length);
        uint256 pos = 0;
        while (true) {
            uint32 nextYield = findBestYield(interestProof, legacyPositions, totVolume, nextExpiration);
            yields[pos] = nextYield;
            nextExpiration = findNextExpiration(interestProof, legacyPositions, nextExpiration);
            durations[pos] = nextExpiration;
            if (nextYield == 0 || nextExpiration == type(uint64).max){
                break;
            }
        }
        uint32[] memory yieldsSlice = new uint32[](pos + 1);
        uint64[] memory durationsSlice = new uint64[](pos + 1);
        for (uint256 i=0; i<=pos; i++){
            yieldsSlice[i] = yields[pos];
            durationsSlice[i] = durations[pos];
        }
        return (yields, durations);
    }

    function findNextExpiration(address[] calldata interestProof, address[] calldata legacyPositions, uint64 minExpiration) internal view returns (uint64) {
        uint64 next = type(uint64).max;
        for (uint256 i=0; i<interestProof.length + legacyPositions.length; i++){
            uint64 exp = IPosition(i < interestProof.length ? interestProof[i] : legacyPositions[i - interestProof.length]).expiration();
            if (exp > minExpiration && exp < next){
                next = exp;
            }
        }
        return next;
    }

    function findBestYield(address[] calldata interestProof, address[] calldata legacyPositions, uint256 volume, uint64 minExp) internal view returns (uint32) {
        uint32 bestYield = 0;
        while (true) {
            uint32 nextYield = findNextYield(interestProof, legacyPositions, minExp, bestYield);
            if (nextYield > bestYield && isFeasible(interestProof, legacyPositions, volume, minExp, nextYield)){
                bestYield = nextYield;
            } else {
                break;
            }
        }
        return bestYield;
    }

    function findNextYield(address[] calldata interestProof, address[] calldata legacyPositions, uint64 minExp, uint32 bestYield) internal view returns (uint32){
        uint32 nextBestYield = bestYield;
        for (uint256 j=0; j<interestProof.length + legacyPositions.length; j++){
            (uint256 minted, uint64 expirationj, uint32 interest) = getData(interestProof, legacyPositions, j);
            if (minted > 0 && expirationj >= minExp && interest > bestYield && interest < nextBestYield){
                nextBestYield = interest;
            }
        }
        return nextBestYield;
    }

    function isFeasible(address[] calldata interestProof, address[] calldata legacyPositions, uint256 volume, uint64 minExp, uint32 yield) internal view returns (bool){
        return volume == 0 || getTotalVolume(yield, minExp, interestProof, legacyPositions) >= volume;
    }

    function getAccount(address owner, uint32 id) external view returns (Account memory) {
        return accounts[getAccountId(owner, id)];
    }

    function getAccountId(address owner, uint32 id) internal pure returns (uint256) {
        return uint160(owner) | (uint256(id) << 160);
    }

    function cleanup(address owner, uint32 id) public {
        cleanup(getAccountId(owner, id));
    }

    /**
     * Call this function to cleanup an account after it reached its maturity.
     */
    function cleanup(uint256 id) internal {
        Account memory account = accounts[id];
        if (block.timestamp < account.end) revert AccountAlive(id);
        address owner = address(uint160(id));
        zchf.transfer(owner, account.amount);
        totalSaved -= account.amount;
        emit Cleanup(owner, uint32(id >> 160));
        delete accounts[id];
    }

    function getTotalVolume(uint32 interestRate, uint64 maturity, address[] calldata interestProof, address[] calldata legacyPositions) internal view returns (uint256) {
        uint256 volume = 0;
        for (uint256 i=0; i<interestProof.length + legacyPositions.length; i++){
            (uint256 minted, uint64 expiration, uint32 interest) = getData(interestProof, legacyPositions, i);
            if (expiration >= maturity && interest >= interestRate){
                volume += minted;
            }
        }
        return volume;
    }

    function getData(address[] calldata interestProof, address[] calldata legacyPositions, uint index) internal view returns (uint256, uint64, uint32){
        if (index < interestProof.length){
            IPosition pos = IPosition(interestProof[index]);
            if (zchf.getPositionParent(address(pos)) == address(0x0)) revert InvalidPosition(address(pos));
            (uint256 minted, uint64 expiration, uint32 interest, uint32 magic) = pos.getPositionStatsOrFailIfNotOriginal(); // assume only positions implements a function with this signature

            // guard against the unlikely case that another Frankencoin ecossystem contract contains a function with the
            // same signature as getPositionStatsOrFailIfNotOriginal. This increases security under the assumption that auditors
            // do not check for duplicate method hashes, but might start asking question when seeing the same magic value elsewhere
            require(magic == 123456789); 
            return (minted, expiration, interest);
        } else {
            IPosition pos = IPosition(legacyPositions[index - interestProof.length]);
            // ensure valid legacy position
            if (zchf.getPositionParent(address(pos)) != legacyHub) revert InvalidPosition(address(pos));
            return (pos.minted(), uint64(pos.expiration()), pos.annualInterestPPM());
        }
    }

    /**
     * Automatic interest calculation is rather conservative.
     * It is possible to temporarily boost the paid out interest in order to create an incentive to save more.
     * This measure might for example be necessary under an unexpected positive interest rate shock.
     */
    function boostInterest(uint256 volume, uint32 interest, uint64 expiration) external returns (address){
        address booster = address(new InterestBoost(equity, volume, interest, expiration));
        zchf.registerPosition(booster);
        emit BoostProposed(address(booster));
        return booster;
    }

}

contract InterestBoost {

    uint256 public immutable volume;
    address public immutable equity;
    uint64 public immutable start;
    uint64 public expiration;
    uint32 public immutable interest;

    error InvalidPosition(address position);
    error TooLate();

    event BoostDenied(address indexed sender, string message); // emitted if closed by governance

    constructor(address equity_, uint256 volume_, uint32 interest_, uint64 maturity_) {
        equity = equity_;
        start = uint64(block.timestamp + 5 days);
        expiration = maturity_;
        volume = volume_;
        interest = interest_;
    }

    function isValid() public view returns(bool){
        return start <= block.timestamp || block.timestamp < expiration;
    }

    function deny(address[] calldata helpers, string calldata message) external {
        if (isValid()) revert TooLate();
        expiration = uint64(block.timestamp);
        IReserve(equity).checkQualified(msg.sender, helpers);
        emit BoostDenied(msg.sender, message);
    }

    function getPositionStatsOrFailIfNotOriginal() external view returns (uint256, uint64, uint32, uint32){
        if (!isValid()) revert InvalidPosition(address(this));
        return (volume, expiration, interest, 123456789);
    }

}
