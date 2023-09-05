// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./utils/Ownable.sol";
import "./utils/MathUtil.sol";

import "./interface/IERC20.sol";
import "./interface/IPosition.sol";
import "./interface/IReserve.sol";
import "./interface/IFrankencoin.sol";

/**
 * A collateralized minting position.
 */
contract Position is Ownable, IPosition, MathUtil {
    /**
     * Note that this contract is intended to be cloned. All clones will share the same values for
     * the constant and immutable fields, but have their own values for the other fields.
     */

    /**
     * The zchf price per unit of the collateral below which challenges succeed, (36 - collateral.decimals) decimals
     */
    uint256 public price;

    /**
     * Net minted amount, including reserve.
     */
    uint256 public minted;

    /**
     * Amount of the collateral that is currently under a challenge.
     * Used to figure out whether there are pending challenges.
     */
    uint256 public challengedAmount;

    /**
     * Challenge period in seconds.
     */
    uint64 public immutable challengePeriod;

    /**
     * End of the latest cooldown. If this is in the future, minting is suspended.
     */
    uint256 public cooldown;

    /**
     * How much can be minted at most.
     */
    uint256 public limit;

    /**
     * Timestamp when minting can start and the position no longer denied.
     */
    uint256 public immutable start;

    /**
     * Timestamp of the expiration of the position. After expiration, challenges cannot be averted
     * any more. This is also the basis for fee calculations.
     */
    uint256 public expiration;

    /**
     * The original position to help identifying clones.
     */
    address public immutable original;

    /**
     * Pointer to the minting hub.
     */
    address public immutable hub;

    /**
     * The Frankencoin contract.
     */
    IFrankencoin public immutable zchf;

    /**
     * The collateral token.
     */
    IERC20 public immutable override collateral;

    /**
     * Minimum acceptable collateral amount to prevent dust.
     */
    uint256 public immutable override minimumCollateral;

    /**
     * The interest in parts per million per year that is deducted when minting Frankencoins.
     * To be paid upfront.
     */
    uint32 public immutable yearlyInterestPPM;

    /**
     * The reserve contribution in parts per million of the minted amount.
     */
    uint32 public immutable reserveContribution;

    event MintingUpdate(uint256 collateral, uint256 price, uint256 minted, uint256 limit);
    event PositionDenied(address indexed sender, string message); // emitted if closed by governance

    error InsufficientCollateral();

    /**
     * See MintingHub.openPosition
     */
    constructor(
        address _owner,
        address _hub,
        address _zchf,
        address _collateral,
        uint256 _minCollateral,
        uint256 _initialLimit,
        uint256 _initPeriod,
        uint256 _duration,
        uint64 _challengePeriod,
        uint32 _yearlyInterestPPM,
        uint256 _liqPrice,
        uint32 _reservePPM
    ) {
        require(_initPeriod >= 3 days); // must be at least three days, recommended to use higher values
        _setOwner(_owner);
        original = address(this);
        hub = _hub;
        zchf = IFrankencoin(_zchf);
        collateral = IERC20(_collateral);
        yearlyInterestPPM = _yearlyInterestPPM;
        reserveContribution = _reservePPM;
        minimumCollateral = _minCollateral;
        challengePeriod = _challengePeriod;
        start = block.timestamp + _initPeriod; // at least three days time to deny the position
        cooldown = start;
        expiration = start + _duration;
        limit = _initialLimit;
        _setPrice(_liqPrice);
    }

    /**
     * Method to initialize a freshly created clone. It is the responsibility of the creator to make sure this is only
     * called once and to call reduceLimitForClone on the original position before initializing the clone.
     */
    function initializeClone(
        address owner,
        uint256 _price,
        uint256 _coll,
        uint256 _initialMint,
        uint256 expirationTime
    ) external onlyHub {
        if (_coll < minimumCollateral) revert InsufficientCollateral();
        uint256 impliedPrice = (_initialMint * ONE_DEC18) / _coll;
        _initialMint = (impliedPrice * _coll) / ONE_DEC18; // to cancel potential rounding errors
        if (impliedPrice > _price) revert InsufficientCollateral();
        _setOwner(owner);
        limit = _initialMint;
        expiration = expirationTime;
        _setPrice(impliedPrice);
        _mint(owner, _initialMint, _coll);
    }

    function limitForClones() public view returns (uint256) {
        uint256 backedLimit = (_collateralBalance() * price) / ONE_DEC18;
        if (backedLimit >= limit) {
            return 0;
        } else {
            // due to invariants, this is always below (limit - minted)
            return limit - backedLimit;
        }
    }

    /**
     * Adjust this position's limit to allow a clone to mint its own Frankencoins.
     * Invariant: global limit stays the same.
     *
     * Cloning a position is only allowed if the position is not challenged, not expired and not in cooldown.
     */
    function reduceLimitForClone(uint256 mint_, uint256 exp) external noChallenge noCooldown alive onlyHub {
        if (exp > expiration || exp < start) revert TooLate(); // ensure exp < start so calculateCurrentFee() cant fail
        if (mint_ > limitForClones()) revert LimitExceeded();
        limit -= mint_;
    }

    error TooLate();

    /**
     * Qualified pool share holders can call this method to immediately expire a freshly proposed position.
     */
    function deny(address[] calldata helpers, string calldata message) external {
        if (block.timestamp >= start) revert TooLate();
        IReserve(zchf.reserve()).checkQualified(msg.sender, helpers);
        _close(); // since expiration is immutable, we put it under eternal cooldown
        emit PositionDenied(msg.sender, message);
    }

    function _close() internal {
        cooldown = type(uint256).max;
    }

    function isClosed() public view returns (bool) {
        return cooldown == type(uint256).max;
    }

    /**
     * This is how much the minter can actually use when minting ZCHF, with the rest being used
     * to buy reserve pool shares.
     */
    function getUsableMint(uint256 totalMint, bool afterFees) external view returns (uint256) {
        if (afterFees) {
            return (totalMint * (1000_000 - reserveContribution - calculateCurrentFee())) / 1000_000;
        } else {
            return (totalMint * (1000_000 - reserveContribution)) / 1000_000;
        }
    }

    /**
     * "All in one" function to adjust the outstanding amount of ZCHF, the collateral amount,
     * and the price in one transaction.
     */
    function adjust(uint256 newMinted, uint256 newCollateral, uint256 newPrice) external onlyOwner {
        uint256 colbal = _collateralBalance();
        if (newCollateral > colbal) {
            collateral.transferFrom(msg.sender, address(this), newCollateral - colbal);
        }
        // Must be called after collateral deposit, but before withdrawal
        if (newMinted < minted) {
            zchf.burnFromWithReserve(msg.sender, minted - newMinted, reserveContribution);
            minted = newMinted;
        }
        if (newCollateral < colbal) {
            withdrawCollateral(msg.sender, colbal - newCollateral);
        }
        // Must be called after collateral withdrawal
        if (newMinted > minted) {
            mint(msg.sender, newMinted - minted);
        }
        if (newPrice != price) {
            adjustPrice(newPrice);
        }
    }

    /**
     * Allows the position owner to adjust the liquidation price as long as there is no pending challenge.
     * Lowering the liquidation price can be done with immediate effect, given that there is enough collateral.
     * Increasing the liquidation price triggers a cooldown period of 3 days, during which minting is suspended.
     */
    function adjustPrice(uint256 newPrice) public onlyOwner noChallenge {
        if (newPrice > price) {
            _restrictMinting(3 days);
        } else {
            _checkCollateral(_collateralBalance(), newPrice);
        }
        _setPrice(newPrice);
        emit MintingUpdate(_collateralBalance(), price, minted, limit);
    }

    function _setPrice(uint256 newPrice) internal {
        require(newPrice * minimumCollateral <= limit * ONE_DEC18); // sanity check
        price = newPrice;
    }

    function _collateralBalance() internal view returns (uint256) {
        return IERC20(collateral).balanceOf(address(this));
    }

    /**
     * Mint ZCHF as long as there is no open challenge, the position is not subject to a cooldown,
     * and there is sufficient collateral.
     */
    function mint(address target, uint256 amount) public onlyOwner noChallenge noCooldown alive {
        _mint(target, amount, _collateralBalance());
    }

    function calculateCurrentFee() public view returns (uint32) {
        uint256 exp = expiration;
        uint256 time = block.timestamp;
        if (time >= exp) {
            return 0;
        } else {
            if (time < start) {
                time = start;
            }
            // Time resolution is in the range of minutes for typical interest rates.
            return uint32(((exp - time) * yearlyInterestPPM) / 365 days);
        }
    }

    error LimitExceeded();

    function _mint(address target, uint256 amount, uint256 collateral_) internal {
        if (minted + amount > limit) revert LimitExceeded();
        zchf.mintWithReserve(target, amount, reserveContribution, calculateCurrentFee());
        minted += amount;

        _checkCollateral(collateral_, price);
        emit MintingUpdate(_collateralBalance(), price, minted, limit);
    }

    function _restrictMinting(uint256 period) internal {
        uint256 horizon = block.timestamp + period;
        if (horizon > cooldown) {
            cooldown = horizon;
        }
    }

    /**
     * Repay some ZCHF. Requires an allowance to be in place. If too much is repaid, the call fails.
     * It is possible to repay while there are challenges, but the collateral is locked until all is clear again.
     *
     * The repaid amount should fulfill the following equation in order to close the position,
     * i.e. bring the minted amount to 0:
     * minted = amount + zchf.calculateAssignedReserve(amount, reservePPM)
     *
     * Under normal circumstances, this implies:
     * amount = minted * (1000000 - reservePPM)
     *
     * E.g. if minted is 50 and reservePPM is 200000, it is necessary to repay 40 to be able to close the position.
     */
    function repay(uint256 amount) public {
        IERC20(zchf).transferFrom(msg.sender, address(this), amount);
        uint256 actuallyRepaid = IFrankencoin(zchf).burnWithReserve(amount, reserveContribution);
        _notifyRepaid(actuallyRepaid);
        emit MintingUpdate(_collateralBalance(), price, minted, limit);
    }

    error RepaidTooMuch(uint256 excess);

    function _notifyRepaid(uint256 amount) internal {
        if (amount > minted) revert RepaidTooMuch(amount - minted);
        minted -= amount;
    }

    /**
     * Withdraw any ERC20 token that might have ended up on this address.
     * Withdrawing collateral is subject to the same restrictions as withdrawCollateral(...).
     */
    function withdraw(address token, address target, uint256 amount) external onlyOwner {
        if (token == address(collateral)) {
            withdrawCollateral(target, amount);
        } else {
            uint256 balance = _collateralBalance();
            IERC20(token).transfer(target, amount);
            require(balance == _collateralBalance()); // guard against double-entry-point tokens
        }
    }

    /**
     * Withdraw collateral from the position up to the extent that it is still well collateralized afterwards.
     * Not possible as long as there is an open challenge or the contract is subject to a cooldown.
     *
     * Withdrawing collateral below the minimum collateral amount formally closes the position.
     */
    function withdrawCollateral(address target, uint256 amount) public onlyOwner noChallenge {
        if (block.timestamp <= cooldown && !isClosed()) revert Hot();
        uint256 balance = _withdrawCollateral(target, amount);
        _checkCollateral(balance, price);
        if (balance < minimumCollateral && balance > 0) revert InsufficientCollateral(); // Prevent dust amounts
    }

    function _withdrawCollateral(address target, uint256 amount) internal returns (uint256) {
        if (amount > 0) {
            // Some weird tokens fail when trying to transfer 0 amounts
            IERC20(collateral).transfer(target, amount);
        }
        uint256 balance = _collateralBalance();
        if (balance < minimumCollateral && challengedAmount == 0) {
            // This leaves a slightly unsatisfying possibility open: if the withdrawal happens due to a successful
            // challenge, there might be a small amount of collateral left that is not withheld in case there are no
            // other pending challenges. The only way to cleanly solve this would be to have two distinct cooldowns, 
            // one for minting and one for withdrawals.
            _close();
        }

        emit MintingUpdate(balance, price, minted, limit);
        return balance;
    }

    /**
     * This invariant must always hold and must always be checked when any of the three
     * variables change in an adverse way.
     */
    function _checkCollateral(uint256 collateralReserve, uint256 atPrice) internal view {
        if (collateralReserve * atPrice < minted * ONE_DEC18) revert InsufficientCollateral();
    }

    /**
     * Returns the liquidation price and the durations for phase1 and phase2 of the challenge.
     * In this implementation, both phases are always of equal length.
     */
    function challengeData() external view returns (uint256 liqPrice, uint64 phase1, uint64 phase2) {
        return (price, challengePeriod, challengePeriod);
    }

    error ChallengeTooSmall();

    function notifyChallengeStarted(uint256 size) external onlyHub {
        // Require minimum size. Collateral balance can be below minimum if it was partially challenged before.
        if (size < minimumCollateral && size < _collateralBalance()) revert ChallengeTooSmall();
        if (size == 0) revert ChallengeTooSmall();
        challengedAmount += size;
    }

    /**
     * @param size   amount of collateral challenged (dec18)
     */
    function notifyChallengeAverted(uint256 size) external onlyHub {
        challengedAmount -= size;
        // Don't allow minter to close the position immediately so challenge can be repeated before
        // the owner has a chance to mint more on an undercollateralized position
        _restrictMinting(1 days);
    }

    /**
     * Notifies the position that a challenge was successful.
     * Triggers the payout of the challenged part of the collateral.
     * Everything else is assumed to be handled by the hub.
     *
     * @param _bidder   address of the bidder that receives the collateral
     * @param _size     size of the collateral bid for (dec 18)
     * @return (position owner, effective challenge size in ZCHF, repaid amount, reserve ppm)
     */
    function notifyChallengeSucceeded(
        address _bidder,
        uint256 _size
    ) external onlyHub returns (address, uint256, uint256, uint32) {
        challengedAmount -= _size;
        uint256 colBal = _collateralBalance();
        if (colBal < _size) {
            _size = colBal;
        }
        uint256 repayment = _mulDiv(minted, _size, colBal);
        _notifyRepaid(repayment); // we assume the caller takes care of the actual repayment
        _withdrawCollateral(_bidder, _size); // transfer collateral to the bidder and emit update

        // Give time for additional challenges before the owner can mint again. In particular,
        // the owner might have added collateral only seconds before the challenge ended, preventing a close.
        _restrictMinting(3 days);

        return (owner, _size, repayment, reserveContribution);
    }

    error Expired();

    modifier alive() {
        if (block.timestamp >= expiration) revert Expired();
        _;
    }

    error Hot();

    modifier noCooldown() {
        if (block.timestamp <= cooldown) revert Hot();
        _;
    }

    error Challenged();

    modifier noChallenge() {
        if (challengedAmount > 0) revert Challenged();
        _;
    }

    error NotHub();

    modifier onlyHub() {
        if (msg.sender != address(hub)) revert NotHub();
        _;
    }
}
