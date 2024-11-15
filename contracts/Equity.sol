// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./EuroCoin.sol";
import "./utils/MathUtil.sol";
import "./interface/IReserve.sol";
import "./interface/IERC677Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

/**
 * @title Equity
 * @notice If the EuroCoin system was a bank, this contract would represent the equity on its balance sheet.
 * Like with a corporation, the owners of the equity capital are the shareholders, or in this case the holders
 * of EuroCoin Pool Shares (EPS) tokens. Anyone can mint additional EPS tokens by adding EuroCoins to the
 * reserve pool. Also, EPS tokens can be redeemed for EuroCoins again after a minimum holding period.
 * Furthermore, the EPS shares come with some voting power. Anyone that held at least 2% of the holding-period-
 * weighted reserve pool shares gains veto power and can veto new proposals.
 */
contract Equity is ERC20PermitLight, MathUtil, IReserve, ERC165 {
    /**
     * The VALUATION_FACTOR determines the market cap of the reserve pool shares relative to the equity reserves.
     * The following always holds: Market Cap = Valuation Factor * Equity Reserve = Price * Supply
     *
     * In the absence of profits and losses, the variables grow as follows when EPS tokens are minted:
     *
     * |   Reserve     |   Market Cap  |     Price     |     Supply   |
     * |          1000 |          3000 |         0.003 |      1000000 |
     * |       1000000 |       3000000 |           0.3 |     10000000 |
     * |    1000000000 |    3000000000 |            30 |    100000000 |
     * | 1000000000000 | 3000000000000 |          3000 |   1000000000 |
     *
     * I.e., the supply is proporational to the cubic root of the reserve and the price is proportional to the
     * squared cubic root. When profits accumulate or losses materialize, the reserve, the market cap,
     * and the price are adjusted proportionally, with the supply staying constant. In the absence of an extreme
     * inflation of the Euro, it is unlikely that there will ever be more than ten million nDEPS.
     */
    uint32 public constant VALUATION_FACTOR = 3;

    uint256 private constant MINIMUM_EQUITY = 1000 * ONE_DEC18;

    /**
     * @notice The quorum in basis points. 100 is 1%.
     */
    uint32 private constant QUORUM = 200;

    /**
     * @notice The number of digits to store the average holding time of share tokens.
     */
    uint8 private constant TIME_RESOLUTION_BITS = 20;

    /**
     * @notice The minimum holding duration. You are not allowed to redeem your pool shares if you held them
     * for less than the minimum holding duration at average. For example, if you have two pool shares on your
     * address, one acquired 5 days ago and one acquired 105 days ago, you cannot redeem them as the average
     * holding duration of your shares is only 55 days < 90 days.
     */
    uint256 public constant MIN_HOLDING_DURATION = 90 days << TIME_RESOLUTION_BITS; // Set to 5 for local testing

    EuroCoin public immutable zeur;

    /**
     * @dev To track the total number of votes we need to know the number of votes at the anchor time and when the
     * anchor time was. This is (hopefully) stored in one 256 bit slot, with the anchor time taking 64 Bits and
     * the total vote count 192 Bits. Given the sub-second resolution of 20 Bits, the implicit assumption is
     * that the timestamp can always be stored in 44 Bits (i.e. it does not exceed half a million years). Further,
     * given 18 decimals (about 60 Bits), this implies that the total supply cannot exceed
     *   192 - 60 - 44 - 20 = 68 Bits
     * Here, we are also save, as 68 Bits would imply more than a trillion outstanding shares. In fact,
     * a limit of about 2**36 shares (that's about 2**96 Bits when taking into account the decimals) is imposed
     * when minting. This means that the maximum supply is billions shares, which is could only be reached in
     * a scenario with hyper inflation, in which case the stablecoin is worthless anyway.
     */
    uint192 private totalVotesAtAnchor; // Total number of votes at the anchor time, see comment on the um
    uint64 private totalVotesAnchorTime; // 44 Bit for the time stamp, 20 Bit sub-second time resolution

    /**
     * @notice Keeping track on who delegated votes to whom.
     * Note that delegation does not mean you cannot vote / veto any more, it just means that the delegate can
     * benefit from your votes when invoking a veto. Circular delegations are valid, do not help when voting.
     */
    mapping(address owner => address delegate) public delegates;

    /**
     * @notice A time stamp in the past such that: votes = balance * (time passed since anchor was set)
     */
    mapping(address owner => uint64 timestamp) private voteAnchor; // 44 bits for time stamp, 20 subsecond resolution

    event Delegation(address indexed from, address indexed to); // indicates a delegation
    event Trade(address who, int amount, uint totPrice, uint newprice); // amount pos or neg for mint or redemption

    constructor(EuroCoin zeur_) ERC20(18) {
        zeur = zeur_;
    }

    function name() external pure override returns (string memory) {
        return "EuroCoin Pool Share";
    }

    function symbol() external pure override returns (string memory) {
        return "EPS";
    }

    /**
     * @notice Returns the price of one EPS in zeur with 18 decimals precision.
     */
    function price() public view returns (uint256) {
        uint256 equity = zeur.equity();
        if (equity == 0 || totalSupply() == 0) {
            // @dev: For Price, 1 = 10^18; 0.001 = 10^15
            return 10 ** 15; // initial price is 1000 dEURO for the first 1_000_000 nDEPS
        } else {
            return (VALUATION_FACTOR * zeur.equity() * ONE_DEC18) / totalSupply();
        }
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        super._beforeTokenTransfer(from, to, amount);
        if (amount > 0) {
            // No need to adjust the sender votes. When they send out 10% of their shares, they also lose 10% of
            // their votes so everything falls nicely into place. Recipient votes should stay the same, but grow
            // faster in the future, requiring an adjustment of the anchor.
            uint256 roundingLoss = _adjustRecipientVoteAnchor(to, amount);
            // The total also must be adjusted and kept accurate by taking into account the rounding error.
            _adjustTotalVotes(from, amount, roundingLoss);
        }
    }

    /**
     * @notice Returns whether the given address is allowed to redeem EPS, which is the
     * case after their average holding duration is larger than the required minimum.
     */
    function canRedeem(address owner) public view returns (bool) {
        return _anchorTime() - voteAnchor[owner] >= MIN_HOLDING_DURATION;
    }

    /**
     * @notice Decrease the total votes anchor when tokens lose their voting power due to being moved
     * @param from      sender
     * @param amount    amount to be sent
     */
    function _adjustTotalVotes(address from, uint256 amount, uint256 roundingLoss) internal {
        uint64 time = _anchorTime();
        uint256 lostVotes = from == address(0x0) ? 0 : (time - voteAnchor[from]) * amount;
        totalVotesAtAnchor = uint192(totalVotes() - roundingLoss - lostVotes);
        totalVotesAnchorTime = time;
    }

    /**
     * @notice the vote anchor of the recipient is moved forward such that the number of calculated
     * votes does not change despite the higher balance.
     * @param to        receiver address
     * @param amount    amount to be received
     * @return the number of votes lost due to rounding errors
     */
    function _adjustRecipientVoteAnchor(address to, uint256 amount) internal returns (uint256) {
        if (to != address(0x0)) {
            uint256 recipientVotes = votes(to); // for example 21 if 7 shares were held for 3 seconds
            uint256 newbalance = balanceOf(to) + amount; // for example 11 if 4 shares are added
            // new example anchor is only 21 / 11 = 1 second in the past
            voteAnchor[to] = uint64(_anchorTime() - recipientVotes / newbalance);
            return recipientVotes % newbalance; // we have lost 21 % 11 = 10 votes
        } else {
            // optimization for burn, vote anchor of null address does not matter
            return 0;
        }
    }

    /**
     * @notice Time stamp with some additional bits for higher resolution.
     */
    function _anchorTime() internal view returns (uint64) {
        return uint64(block.timestamp << TIME_RESOLUTION_BITS);
    }

    /**
     * @notice The relative voting power of the address.
     * @return A percentage with 1e18 being 100%
     */
    function relativeVotes(address holder) external view returns (uint256) {
        return (ONE_DEC18 * votes(holder)) / totalVotes();
    }

    /**
     * @notice The votes of the holder, excluding votes from delegates.
     */
    function votes(address holder) public view returns (uint256) {
        return balanceOf(holder) * (_anchorTime() - voteAnchor[holder]);
    }

    /**
     * @notice How long the holder already held onto their average EPS in seconds.
     */
    function holdingDuration(address holder) public view returns (uint256) {
        return (_anchorTime() - voteAnchor[holder]) >> TIME_RESOLUTION_BITS;
    }

    /**
     * @notice Total number of votes in the system.
     */
    function totalVotes() public view returns (uint256) {
        return totalVotesAtAnchor + totalSupply() * (_anchorTime() - totalVotesAnchorTime);
    }

    /**
     * @notice The number of votes the sender commands when taking the support of the helpers into account.
     * @param sender    The address whose total voting power is of interest
     * @param helpers   An incrementally sorted list of helpers without duplicates and without the sender.
     *                  The call fails if the list contains an address that does not delegate to sender.
     *                  For indirect delegates, i.e. a -> b -> c, both a and b must be included for both to count.
     * @return          The total number of votes of sender at the current point in time.
     */
    function votesDelegated(address sender, address[] calldata helpers) public view returns (uint256) {
        uint256 _votes = votes(sender);
        require(_checkDuplicatesAndSorted(helpers));
        for (uint i = 0; i < helpers.length; i++) {
            address current = helpers[i];
            require(current != sender);
            require(_canVoteFor(sender, current));
            _votes += votes(current);
        }
        return _votes;
    }

    function _checkDuplicatesAndSorted(address[] calldata helpers) internal pure returns (bool ok) {
        if (helpers.length <= 1) {
            return true;
        } else {
            address prevAddress = helpers[0];
            for (uint i = 1; i < helpers.length; i++) {
                if (helpers[i] <= prevAddress) {
                    return false;
                }
                prevAddress = helpers[i];
            }
            return true;
        }
    }

    /**
     * @notice Checks whether the sender address is qualified given a list of helpers that delegated their votes
     * directly or indirectly to the sender. It is the responsiblity of the caller to figure out whether
     * helpes are necessary and to identify them by scanning the blockchain for Delegation events.
     */
    function checkQualified(address sender, address[] calldata helpers) public view override {
        uint256 _votes = votesDelegated(sender, helpers);
        if (_votes * 10000 < QUORUM * totalVotes()) revert NotQualified();
    }

    error NotQualified();

    /**
     * @notice Increases the voting power of the delegate by your number of votes without taking away any voting power
     * from the sender.
     */
    function delegateVoteTo(address delegate) external {
        delegates[msg.sender] = delegate;
        emit Delegation(msg.sender, delegate);
    }

    function _canVoteFor(address delegate, address owner) internal view returns (bool) {
        if (owner == delegate) {
            return true;
        } else if (owner == address(0x0)) {
            return false;
        } else {
            return _canVoteFor(delegate, delegates[owner]);
        }
    }

    /**
     * @notice Since quorum is rather low, it is important to have a way to prevent malicious minority holders
     * from blocking the whole system. This method provides a way for the good guys to team up and destroy
     * the bad guy's votes (at the cost of also reducing their own votes). This mechanism potentially
     * gives full control over the system to whoever has 51% of the votes.
     *
     * Since this is a rather aggressive measure, delegation is not supported. Every holder must call this
     * method on their own.
     * @param targets   The target addresses to remove votes from
     * @param votesToDestroy    The maximum number of votes the caller is willing to sacrifice
     */
    function kamikaze(address[] calldata targets, uint256 votesToDestroy) external {
        uint256 budget = _reduceVotes(msg.sender, votesToDestroy);
        uint256 destroyedVotes = 0;
        for (uint256 i = 0; i < targets.length && destroyedVotes < budget; i++) {
            destroyedVotes += _reduceVotes(targets[i], budget - destroyedVotes);
        }
        require(destroyedVotes > 0); // sanity check
        totalVotesAtAnchor = uint192(totalVotes() - destroyedVotes - budget);
        totalVotesAnchorTime = _anchorTime();
    }

    function _reduceVotes(address target, uint256 amount) internal returns (uint256) {
        uint256 votesBefore = votes(target);
        if (amount >= votesBefore) {
            amount = votesBefore;
            voteAnchor[target] = _anchorTime();
            return votesBefore;
        } else {
            voteAnchor[target] = uint64(_anchorTime() - (votesBefore - amount) / balanceOf(target));
            return votesBefore - votes(target);
        }
    }

    /**
     * @notice Call this method to obtain newly minted pool shares in exchange for EuroCoins.
     * No allowance required (i.e. it is hardcoded in the EuroCoin token contract).
     * Make sure to invest at least 10e-12 * market cap to avoid rounding losses.
     *
     * @dev If equity is close to zero or negative, you need to send enough zeur to bring equity back to 1000 zeur.
     *
     * @param amount            EuroCoins to invest
     * @param expectedShares    Minimum amount of expected shares for frontrunning protection
     */
    function invest(uint256 amount, uint256 expectedShares) external returns (uint256) {
        zeur.transferFrom(msg.sender, address(this), amount);
        uint256 equity = zeur.equity();
        require(equity >= MINIMUM_EQUITY, "insuf equity"); // ensures that the initial deposit is at least 1000 zeur

        uint256 shares = _calculateShares(equity <= amount ? 0 : equity - amount, amount);
        require(shares >= expectedShares);
        _mint(msg.sender, shares);
        emit Trade(msg.sender, int(shares), amount, price());

        // limit the total supply to a reasonable amount to guard against overflows with price and vote calculations
        // the 36 bits are 68 bits for magnitude and 60 bits for precision, as calculated in an above comment
        require(totalSupply() <= type(uint96).max, "total supply exceeded");
        return shares;
    }

    /**
     * @notice Calculate shares received when investing EuroCoins
     * @param investment    ZEUR to be invested
     * @return shares to be received in return
     */
    function calculateShares(uint256 investment) external view returns (uint256) {
        return _calculateShares(zeur.equity(), investment);
    }

    function _calculateShares(uint256 capitalBefore, uint256 investment) internal view returns (uint256) {
        uint256 totalShares = totalSupply();
        uint256 investmentExFees = (investment * 997) / 1000; // remove 0.3% fee
        // Assign 1000 EPS for the initial deposit, calculate the amount otherwise
        uint256 newTotalShares = capitalBefore < MINIMUM_EQUITY || totalShares == 0
            ? totalShares + 1_000_000 * ONE_DEC18
            : _mulD18(totalShares, _cubicRoot(_divD18(capitalBefore + investmentExFees, capitalBefore)));
        return newTotalShares - totalShares;
    }

    /**
     * @notice Redeem the given amount of shares owned by the sender and transfer the proceeds to the target.
     * @return The amount of ZEUR transferred to the target
     */
    function redeem(address target, uint256 shares) external returns (uint256) {
        return _redeemFrom(msg.sender, target, shares);
    }

    /**
     * @notice Like redeem(...), but with an extra parameter to protect against frontrunning.
     * @param expectedProceeds  The minimum acceptable redemption proceeds.
     */
    function redeemExpected(address target, uint256 shares, uint256 expectedProceeds) external returns (uint256) {
        uint256 proceeds = _redeemFrom(msg.sender, target, shares);
        require(proceeds >= expectedProceeds);
        return proceeds;
    }

    /**
     * @notice Redeem EPS based on an allowance from the owner to the caller.
     * See also redeemExpected(...).
     */
    function redeemFrom(
        address owner,
        address target,
        uint256 shares,
        uint256 expectedProceeds
    ) external returns (uint256) {
        _useAllowance(owner, msg.sender, shares);
        uint256 proceeds = _redeemFrom(owner, target, shares);
        require(proceeds >= expectedProceeds);
        return proceeds;
    }

    function _redeemFrom(address owner, address target, uint256 shares) internal returns (uint256) {
        require(canRedeem(owner));
        uint256 proceeds = calculateProceeds(shares);
        _burn(owner, shares);
        zeur.transfer(target, proceeds);
        emit Trade(owner, -int(shares), proceeds, price());
        return proceeds;
    }

    /**
     * @notice Calculate ZEUR received when depositing shares
     * @param shares number of shares we want to exchange for ZEUR,
     *               in dec18 format
     * @return amount of ZEUR received for the shares
     */
    function calculateProceeds(uint256 shares) public view returns (uint256) {
        uint256 totalShares = totalSupply();
        require(shares + ONE_DEC18 < totalShares, "too many shares"); // make sure there is always at least one share
        uint256 capital = zeur.equity();
        uint256 reductionAfterFees = (shares * 997) / 1000;
        uint256 newCapital = _mulD18(capital, _power3(_divD18(totalShares - reductionAfterFees, totalShares)));
        return capital - newCapital;
    }

    /**
     * @notice If there is less than 1000 ZEUR in equity left (maybe even negative), the system is at risk
     * and we should allow qualified EPS holders to restructure the system.
     *
     * Example: there was a devastating loss and equity stands at -1'000'000. Most shareholders have lost hope in the
     * EuroCoin system except for a group of small EPS holders who still believes in it and is willing to provide
     * 2'000'000 ZEUR to save it. These brave souls are essentially donating 1'000'000 to the minter reserve and it
     * would be wrong to force them to share the other million with the passive EPS holders. Instead, they will get
     * the possibility to bootstrap the system again owning 100% of all EPS shares.
     *
     * @param helpers          A list of addresses that delegate to the caller in incremental order
     * @param addressesToWipe  A list of addresses whose EPS will be burned to zero
     */
    function restructureCapTable(address[] calldata helpers, address[] calldata addressesToWipe) external {
        require(zeur.equity() < MINIMUM_EQUITY);
        checkQualified(msg.sender, helpers);
        for (uint256 i = 0; i < addressesToWipe.length; i++) {
            address current = addressesToWipe[i];
            _burn(current, balanceOf(current));
        }
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view override virtual returns (bool) {
        return
            interfaceId == type(IERC20).interfaceId ||
            interfaceId == type(ERC20PermitLight).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
