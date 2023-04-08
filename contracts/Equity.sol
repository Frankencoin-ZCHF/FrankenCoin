
// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import "./Frankencoin.sol";
import "./IERC677Receiver.sol";
import "./ERC20PermitLight.sol";
import "./MathUtil.sol";
import "./IReserve.sol";

/** 
 * If the Frankencoin system was a bank, this contract would represent the equity on its balance sheet.
 * Like with a corporation, the owners of the equity capital are the shareholders, or in this case the holders
 * of Frankencoin Pool Shares (FPS) tokens. Anyone can mint additional FPS tokens by adding Frankencoins to the
 * reserve pool. Also, FPS tokens can be redeemed for Frankencoins again after a minimum holding period.
 * Furthermore, the FPS shares come with some voting power. Anyone that held at least 3% of the holding-period-
 * weighted reserve pool shares gains veto power and can veto new proposals.
 */
contract Equity is ERC20PermitLight, MathUtil, IReserve {

    /**
     * The VALUATION_FACTOR determines the market cap of the reserve pool shares relative to the equity reserves.
     * The following always holds: Market Cap = Valuation Factor * Equity Reserve = Price * Supply
     *
     * In the absence of profits and losses, the variables grow as follows when FPS tokens are minted:
     *
     * |   Reserve     |   Market Cap  |     Price     |     Supply   |
     * |          1000 |          3000 |             3 |         1000 |
     * |       1000000 |       3000000 |           300 |        10000 |
     * |    1000000000 |    3000000000 |         30000 |       100000 |
     * | 1000000000000 | 3000000000000 |       3000000 |      1000000 |
     *
     * I.e., the supply is proporational to the cubic root of the reserve and the price is proportional to the
     * squared cubic root. When profits accumulate or losses materialize, the reserve, the market cap,
     * and the price are adjusted proportionally, with the supply staying constant. In the absence of an extreme
     * inflation of the Swiss franc, it is unlikely that there will ever be more than ten million FPS.
     */
    uint32 public constant VALUATION_FACTOR = 3;

    uint256 private constant MINIMUM_EQUITY = 1000 * ONE_DEC18;

    /**
     * The quorum in basis points. 100 is 1%.
     */
    uint32 private constant QUORUM = 300;

    /**
     * The number of digits to store the average holding time of share tokens.
     */
    uint8 private constant BLOCK_TIME_RESOLUTION_BITS = 24;

    /**
     * The minimum holding duration in blocks. You are not allowed to redeem your pool shares if you held them
     * for less than the minimum holding duration at average. For example, if you have two pool shares on your
     * address, one acquired 5 days ago and one acquired 105 days ago, you cannot redeem them as the average
     * holding duration of your shares is only 55 days < 90 days.
     */
    uint256 public constant MIN_HOLDING_DURATION = 90*7200 << BLOCK_TIME_RESOLUTION_BITS; // Set to 5 for local testing

    Frankencoin immutable public zchf;

    /**
     * To track the total number of votes we need to know the number of votes at the anchor time and when the
     * anchor time was. This is (hopefully) stored in one 256 bit slot, with the anchor time taking 64 Bits and
     * the total vote count 192 Bits. Given the sub-block time resolution of 24 Bits, the implicit assumption is
     * that the block number can always be stored in 40 Bits (i.e. it does not exceed a trillion). Further,
     * given 18 decimals (about 60 Bits), this implies that the total supply cannot exceed 
     *   192 - 60 - 40 - 24 = 68 Bits
     * Here, we are also save, as 68 Bits would imply more than a trillion outstanding shares. In fact, when
     * minting, a limit of about 2**30 shares (that's 2**90 Bits when taking into account the decimals) is imposed
     * when minting. This means that the maximum supply is about a billion shares, which is reached at a market
     * cap of 3,000,000,000,000,000,000 CHF. This limit could in theory be reached in times of hyper inflaction. 
     */
    uint192 private totalVotesAtAnchor;  // Total number of votes at the anchor time, see comment on the um
    uint64 private totalVotesAnchorTime; // 40 Bit for the block number, 24 Bit sub-block time resolution

    /**
     * Keeping track on who delegated votes to whom.
     * Note that delegation does not mean you cannot vote / veto any more, it just means that the delegate can
     * benefit from your votes when invoking a veto. Circular delegations are valid, do not help when voting.
     */
    mapping (address => address) public delegates;

    /**
     * A block number in the past such that: votes = balance * (time passed since anchor was set)
     */
    mapping (address => uint64) private voteAnchor; // 40 Bit for the block number, 24 Bit sub-block time resolution

    event Delegation(address indexed from, address indexed to); // indicates a delegation
    event Trade(address who, int amount, uint totPrice, uint newprice); // amount pos or neg for mint or redemption

    constructor(Frankencoin zchf_) ERC20(18) {
        zchf = zchf_;
    }

    function name() override external pure returns (string memory) {
        return "Frankencoin Pool Share";
    }

    function symbol() override external pure returns (string memory) {
        return "FPS";
    }

    /**
     * Returns the price of one FPS in ZCHF with 18 decimals precision.
     */
    function price() public view returns (uint256){
        return VALUATION_FACTOR * zchf.equity() * ONE_DEC18 / totalSupply();
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) override internal {
        super._beforeTokenTransfer(from, to, amount);
        if (amount > 0){
            // No need to adjust the sender votes. When they send out 10% of their shares, they also lose 10% of
            // their votes so everything falls nicely into place.
            // Recipient votes should stay the same, but grow faster in the future, requiring an adjustment of the anchor.
            uint256 roundingLoss = adjustRecipientVoteAnchor(to, amount);
            // The total also must be adjusted and kept accurate by taking into account the rounding error.
            adjustTotalVotes(from, amount, roundingLoss);
        }
    }

    /**
     * Returns whether the sender address is allowed to redeem FPS.
     */
    function canRedeem() external view returns (bool){
        return canRedeem(msg.sender);
    }

    /**
     * Returns whether the given address is allowed to redeem FPS, which is the
     * case after their average holding duration is larger than the required minimum.
     */
    function canRedeem(address owner) public view returns (bool) {
        return anchorTime() - voteAnchor[owner] >= MIN_HOLDING_DURATION;
    }

     /**
     * @notice Decrease the total votes anchor when tokens lose their voting power due to being moved
     * @param from      sender
     * @param amount    amount to be sent
     */
    function adjustTotalVotes(address from, uint256 amount, uint256 roundingLoss) internal {
        uint256 lostVotes = from == address(0x0) ? 0 : (anchorTime() - voteAnchor[from]) * amount;
        totalVotesAtAnchor = uint192(totalVotes() - roundingLoss - lostVotes);
        totalVotesAnchorTime = anchorTime();
    }

    /**
     * @notice the vote anchor of the recipient is moved forward such that the number of calculated
     * votes does not change despite the higher balance.
     * @param to        receiver address
     * @param amount    amount to be received
     * @return the number of votes lost due to rounding errors
     */
    function adjustRecipientVoteAnchor(address to, uint256 amount) internal returns (uint256){
        if (to != address(0x0)) {
            uint256 recipientVotes = votes(to); // for example 21 if 7 shares were held for 3 blocks
            uint256 newbalance = balanceOf(to) + amount; // for example 11 if 4 shares are added
            voteAnchor[to] = uint64(anchorTime() - recipientVotes / newbalance); // new example anchor is only 21 / 11 = 1 block in the past
            return recipientVotes % newbalance; // we have lost 21 % 11 = 10 votes
        } else {
            // optimization for burn, vote anchor of null address does not matter
            return 0;
        }
    }

    /**
     * Block number with some additional Bits for higher resolution.
     */
    function anchorTime() internal view returns (uint64){
        return uint64(block.number << BLOCK_TIME_RESOLUTION_BITS);
    }

    /**
     * The votes of the holder, excluding votes from delegates.
     */
    function votes(address holder) public view returns (uint256) {
        return balanceOf(holder) * (anchorTime() - voteAnchor[holder]);
    }

    /**
     * Total number of votes in the system.
     */
    function totalVotes() public view returns (uint256) {
        return totalVotesAtAnchor + totalSupply() * (anchorTime() - totalVotesAnchorTime);
    }

    function votes(address sender, address[] calldata helpers) public view returns (uint256) {
        uint256 _votes = votes(sender);
        for (uint i=0; i<helpers.length; i++){
            address current = helpers[i];
            require(current != sender);
            require(canVoteFor(sender, current));
            for (uint j=i+1; j<helpers.length; j++){
                require(current != helpers[j]); // ensure helper unique
            }
            _votes += votes(current);
        }
        return _votes;
    }

    /**
     * Checks whether the sender address is qualified given a list of helpers that delegated their votes
     * directly or indirectly to the sender. It is the responsiblity of the caller to figure out whether
     * helpes are necessary and to identify them by scanning the blockchain for Delegation events. 
     */
    function checkQualified(address sender, address[] calldata helpers) public override view {
        uint256 _votes = votes(sender, helpers);
        if (_votes * 10000 < QUORUM * totalVotes()) revert NotQualified();
    }

    error NotQualified();

    /**
     * Increases the voting power of the delegate by your number of votes without taking away any voting power
     * from the sender.
     */
    function delegateVoteTo(address delegate) external {
        delegates[msg.sender] = delegate;
        emit Delegation(msg.sender, delegate);
    }

    function canVoteFor(address delegate, address owner) internal view returns (bool) {
        if (owner == delegate){
            return true;
        } else if (owner == address(0x0)){
            return false;
        } else {
            return canVoteFor(delegate, delegates[owner]);
        }
    }

    /**
     * In order to mint new FPS tokens, one needs to send ZCHF to this contract using the transferAndCall function
     * in the ZCHF contract.
     *
     * If equity is close to zero or negative, you need to send enough ZCHF to bring equity back to 1000 ZCHF.
     */
    function onTokenTransfer(address from, uint256 amount, bytes calldata) external returns (bool) {
        require(msg.sender == address(zchf), "caller must be zchf");
        uint256 equity = zchf.equity();
        require(equity >= MINIMUM_EQUITY, "insuf equity"); // ensures that the initial deposit is at least 1000 ZCHF

        // Assign 1000 FPS for the initial deposit, calculate the amount otherwise
        uint256 shares = equity <= amount ? 1000 * ONE_DEC18 : calculateSharesInternal(equity - amount, amount);
        _mint(from, shares);
        emit Trade(msg.sender, int(shares), amount, price());

        // limit the total supply to a reasonable amount to guard against overflows with price and vote calculations
        // the 128 bits are 68 bits for magnitude and 60 bits for precision, as calculated in an above comment
        require(totalSupply() < 2**128, "total supply exceeded");
        return true;
    }

    /**
     * @notice Calculate shares received when depositing ZCHF
     * @param investment ZCHF invested
     * @return amount of shares received for the ZCHF invested
     */
    function calculateShares(uint256 investment) public view returns (uint256) {
        return calculateSharesInternal(zchf.equity(), investment);
    }

    function calculateSharesInternal(uint256 capitalBefore, uint256 investment) internal view returns (uint256) {
        uint256 totalShares = totalSupply();
        uint256 newTotalShares = totalShares < 1000 * ONE_DEC18 ? 1000 * ONE_DEC18 : _mulD18(totalShares, _cubicRoot(_divD18(capitalBefore + investment, capitalBefore)));
        return newTotalShares - totalShares;
    }

    /**
     * Redeem the given amount of shares owned by the sender and transfer the proceeds to the target.
     */
    function redeem(address target, uint256 shares) public returns (uint256) {
        require(canRedeem(msg.sender));
        uint256 proceeds = calculateProceeds(shares);
        _burn(msg.sender, shares);
        zchf.transfer(target, proceeds);
        emit Trade(msg.sender, -int(shares), proceeds, price());
        return proceeds;
    }

    /**
     * @notice Calculate ZCHF received when depositing shares
     * @param shares number of shares we want to exchange for ZCHF,
     *               in dec18 format
     * @return amount of ZCHF received for the shares
     */
    function calculateProceeds(uint256 shares) public view returns (uint256) {
        uint256 totalShares = totalSupply();
        uint256 capital = zchf.equity();
        require(shares + ONE_DEC18 < totalShares, "too many shares"); // make sure there is always at least one share
        uint256 newTotalShares = totalShares - shares;
        uint256 newCapital = _mulD18(capital, _power3(_divD18(newTotalShares, totalShares)));
        return capital - newCapital;
    }

    /**
     * If there is less than 1000 ZCHF in equity left (maybe even negative), the system is at risk
     * and we should allow qualified FPS holders to restructure the system.
     *
     * Example: there was a devastating loss and equity stands at -1'000'000. Most shareholders have lost hope in the
     * Frankencoin system except for a group of small FPS holders who still believes in it and is willing to provide
     * 2'000'000 ZCHF to save it. These brave souls are essentially donating 1'000'000 to the minter reserve and it
     * would be wrong to force them to share the other million with the passive FPS holders. Instead, they will get
     * the possibility to bootstrap the system again owning 100% of all FPS shares.
     */
    function restructureCapTable(address[] calldata helpers, address[] calldata addressesToWipe) public {
        require(zchf.equity() < MINIMUM_EQUITY);
        checkQualified(msg.sender, helpers);
        for (uint256 i = 0; i<addressesToWipe.length; i++){
            address current = addressesToWipe[0];
            _burn(current, balanceOf(current));
        }
    }

}