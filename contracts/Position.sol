// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./utils/Ownable.sol";
import "./utils/MathUtil.sol";

import "./interface/IERC20.sol";
import "./interface/ILeadrate.sol";
import "./interface/IPosition.sol";
import "./interface/IReserve.sol";
import "./interface/IFrankencoin.sol";

// import "hardhat/console.sol";

/**
 * @title Position
 * @notice A collateralized minting position.
 */
contract Position is Ownable, IPosition, MathUtil {
    /**
     * @notice Note that this contract is intended to be cloned. All clones will share the same values for
     * the constant and immutable fields, but have their own values for the other fields.
     */

    /**
     * @notice The zchf price per unit of the collateral below which challenges succeed, (36 - collateral.decimals) decimals
     */
    uint256 public price;

    /**
     * @notice Net minted amount, including reserve.
     */
    uint256 public minted;

    /**
     * @notice How much has been minted in total. This variable is only used in the parent position.
     */
    uint256 private totalMinted;

    uint256 private immutable limit;

    /**
     * @notice Amount of the collateral that is currently under a challenge.
     * Used to figure out whether there are pending challenges.
     */
    uint256 public challengedAmount;

    /**
     * @notice Challenge period in seconds.
     */
    uint40 public immutable challengePeriod;

    /**
     * @notice Timestamp when minting can start and the position no longer denied.
     */
    uint40 public immutable start;

    /**
     * @notice End of the latest cooldown. If this is in the future, minting is suspended.
     */
    uint40 public cooldown;

    /**
     * @notice Timestamp of the expiration of the position. After expiration, challenges cannot be averted
     * any more. This is also the basis for fee calculations.
     */
    uint40 public expiration;

    /**
     * @notice The original position to help identifying clones.
     */
    address public immutable original;

    /**
     * @notice Pointer to the minting hub.
     */
    address public immutable hub;

    /**
     * @notice The Frankencoin contract.
     */
    IFrankencoin public immutable zchf;

    /**
     * @notice The collateral token.
     */
    IERC20 public immutable override collateral;

    /**
     * @notice Minimum acceptable collateral amount to prevent dust.
     */
    uint256 public immutable override minimumCollateral;

    /**
     * @notice The interest in parts per million per year that is deducted when minting Frankencoins.
     * To be paid upfront.
     */
    uint24 public immutable riskPremiumPPM;

    /**
     * @notice The reserve contribution in parts per million of the minted amount.
     */
    uint24 public immutable reserveContribution;

    event MintingUpdate(uint256 collateral, uint256 price, uint256 minted);
    event PositionDenied(address indexed sender, string message); // emitted if closed by governance

    error InsufficientCollateral();
    error TooLate();
    error RepaidTooMuch(uint256 excess);
    error LimitExceeded(uint256 available);
    error ChallengeTooSmall();
    error Expired(uint40 time, uint40 expiration);
    error Alive();
    error Hot();
    error Challenged();
    error NotHub();
    error NotOriginal();
    error ExpirationAfterOriginal();

    modifier alive() {
        if (block.timestamp >= expiration) revert Expired(uint40(block.timestamp), expiration);
        _;
    }

    modifier expired() {
        if (block.timestamp < expiration) revert Alive();
        _;
    }

    modifier noCooldown() {
        if (block.timestamp <= cooldown) revert Hot();
        _;
    }

    modifier noChallenge() {
        if (challengedAmount > 0) revert Challenged();
        _;
    }

    modifier onlyHub() {
        if (msg.sender != address(hub)) revert NotHub();
        _;
    }

    modifier ownerOrRoller() {
        if (msg.sender != address(IHub(hub).roller())) _requireOwner(msg.sender);
        _;
    }

    /**
     * @dev See MintingHub.openPosition
     */
    constructor(address _owner, address _hub, address _zchf, address _collateral,
        uint256 _minCollateral, uint256 _initialLimit,
        uint40 _initPeriod, uint40 _duration, uint40 _challengePeriod,
        uint24 _riskPremiumPPM, uint256 _liqPrice, uint24 _reservePPM) {
        require(_initPeriod >= 3 days); // must be at least three days, recommended to use higher values
        _setOwner(_owner);
        original = address(this);
        hub = _hub;
        zchf = IFrankencoin(_zchf);
        collateral = IERC20(_collateral);
        riskPremiumPPM = _riskPremiumPPM;
        reserveContribution = _reservePPM;
        minimumCollateral = _minCollateral;
        challengePeriod = _challengePeriod;
        start = uint40(block.timestamp) + _initPeriod; // at least three days time to deny the position
        cooldown = start;
        expiration = start + _duration;
        limit = _initialLimit;
        _setPrice(_liqPrice, _initialLimit);
    }

    /**
     * Initialization method for clones.
     * Can only be called once. Should be called immediately after creating the clone.
     */
    function initialize(address owner, Position parent, uint40 _expiration) external onlyOwner {
        if (_expiration > Position(original).expiration()) revert ExpirationAfterOriginal(); // original might have later expiration than parent, which is ok
        expiration = _expiration;
        _setOwner(owner);
        price = parent.price();
    }

/*     /**
    function transferOwnerAndMint(address newOwner, uint256 mintAmount, uint256 newPrice) external onlyOwner {
        _setOwner(newOwner);
        uint256 colbal = _collateralBalance();
        _mint(newOwner, mintAmount, colbal);
        if (newPrice != price) {
            _adjustPrice(newPrice);
        }
        emit MintingUpdate(colbal, newPrice, minted);
    } */

    /**
     * Cloning a position is only allowed if the position is not challenged, not expired and not in cooldown.
     */
    function assertCloneable() external noChallenge noCooldown alive {}

    /**
     * Notify the original that some amount has been minted.
     */
    function notifyMint(uint256 mint_) external {
        if (zchf.getPositionParent(msg.sender) != hub) revert NotHub();
        totalMinted += mint_;
    }

    function notifyRepaid(uint256 repaid_) external {
        if (zchf.getPositionParent(msg.sender) != hub) revert NotHub();
        totalMinted -= repaid_;
    }

    function globalLimit() external view returns (uint256) {
        if (address(this) == original) {
            return limit;
        } else {
            return Position(original).globalLimit();
        }
    }

    function availableForClones() external view returns (uint256) {
        // reserve capacity for the original to the extent the owner provided collateral
        uint256 unusedPotential = (_collateralBalance() * price) / ONE_DEC18 - minted;
        if (totalMinted + unusedPotential >= limit) {
            return 0;
        } else {
            return limit - totalMinted - unusedPotential;
        }
    }

    function availableForMinting() public view returns (uint256) {
        if (address(this) == original) {
            return limit - totalMinted;
        } else {
            return Position(original).availableForClones();
        }
    }

    /**
     * @notice Qualified pool share holders can call this method to immediately expire a freshly proposed position.
     */
    function deny(address[] calldata helpers, string calldata message) external {
        if (block.timestamp >= start) revert TooLate();
        IReserve(zchf.reserve()).checkQualified(msg.sender, helpers);
        _close();
        emit PositionDenied(msg.sender, message);
    }

    /**
     * Closes the position by putting it into eternal cooldown.
     * This allows the users to still withdraw the collateral that is left, but never to mint again.
     */
    function _close() internal {
        cooldown = type(uint40).max;
    }

    function isClosed() public view returns (bool) {
        return cooldown == type(uint40).max;
    }

    /**
     * @notice This is how much the minter can actually use when minting ZCHF, with the rest being used
     * assigned to the minter reserve or (if applicable) fees.
     */
    function getUsableMint(uint256 totalMint, bool afterFees) external view returns (uint256) {
        if (afterFees) {
            return (totalMint * (1000_000 - reserveContribution - calculateCurrentFee())) / 1000_000;
        } else {
            return (totalMint * (1000_000 - reserveContribution)) / 1000_000;
        }
    }

    /**
     * @notice "All in one" function to adjust the outstanding amount of ZCHF, the collateral amount,
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
            _notifyRepaid(minted - newMinted);
        }
        if (newCollateral < colbal) {
            _withdrawCollateral(msg.sender, colbal - newCollateral);
        }
        // Must be called after collateral withdrawal
        if (newMinted > minted) {
            _mint(msg.sender, newMinted - minted, newCollateral);
        }
        if (newPrice != price) {
            _adjustPrice(newPrice);
        }
        emit MintingUpdate(newCollateral, newPrice, newMinted);
    }

    /**
     * @notice Allows the position owner to adjust the liquidation price as long as there is no pending challenge.
     * Lowering the liquidation price can be done with immediate effect, given that there is enough collateral.
     * Increasing the liquidation price triggers a cooldown period of 3 days, during which minting is suspended.
     */
    function adjustPrice(uint256 newPrice) public onlyOwner {
        _adjustPrice(newPrice);
        emit MintingUpdate(_collateralBalance(), price, minted);
    }

    function _adjustPrice(uint256 newPrice) internal noChallenge {
        if (newPrice > price) {
            _restrictMinting(3 days);
        } else {
            _checkCollateral(_collateralBalance(), newPrice);
        }
        _setPrice(newPrice, minted + availableForMinting());
    }

    function _setPrice(uint256 newPrice, uint256 bounds) internal {
        require(newPrice * minimumCollateral <= bounds * ONE_DEC18); // sanity check
        price = newPrice;
    }

    function _collateralBalance() internal view returns (uint256) {
        return IERC20(collateral).balanceOf(address(this));
    }

    /**
     * @notice Mint ZCHF as long as there is no open challenge, the position is not subject to a cooldown,
     * and there is sufficient collateral.
     */
    function mint(address target, uint256 amount) public ownerOrRoller {
        uint256 collateralBalance = _collateralBalance();
        _mint(target, amount, collateralBalance);
        emit MintingUpdate(collateralBalance, price, minted);
    }

    function calculateCurrentFee() public view returns (uint24) {
        return calculateFee(expiration);
    }

    function annualInterestPPM() public view returns (uint24) {
        return IHub(hub).rate().currentRatePPM() + riskPremiumPPM;
    }

    function calculateFee(uint256 exp) public view returns (uint24) {
        uint256 time = block.timestamp < start ? start : block.timestamp;
        uint256 timePassed = exp - time;
        // Time resolution is in the range of minutes for typical interest rates.
        uint256 feePPM = (timePassed * annualInterestPPM()) / 365 days;
        return uint24(feePPM > 1000000 ? 1000000 : feePPM); // fee cannot exceed 100%
    }

    function _mint(address target, uint256 amount, uint256 collateral_) internal noChallenge noCooldown alive {
        if (amount > availableForMinting()) revert LimitExceeded(availableForMinting());
        Position(original).notifyMint(amount);
        zchf.mintWithReserve(target, amount, reserveContribution, calculateCurrentFee());
        minted += amount;
        _checkCollateral(collateral_, price);
    }

    function _restrictMinting(uint40 period) internal {
        uint40 horizon = uint40(block.timestamp) + period;
        if (horizon > cooldown) {
            cooldown = horizon;
        }
    }

    /**
     * @notice Repay some ZCHF. If too much is repaid, the call fails.
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
    function repay(uint256 amount) public returns (uint256) {
        IERC20(zchf).transferFrom(msg.sender, address(this), amount);
        uint256 actuallyRepaid = IFrankencoin(zchf).burnWithReserve(amount, reserveContribution);
        _notifyRepaid(actuallyRepaid);
        emit MintingUpdate(_collateralBalance(), price, minted);
        return actuallyRepaid;
    }

    function _notifyRepaid(uint256 amount) internal {
        if (amount > minted) revert RepaidTooMuch(amount - minted);
        Position(original).notifyRepaid(amount);
        minted -= amount;
    }

    function forceSale(address buyer, uint256 collAmount, uint256 proceeds) external onlyHub expired {
        if (minted > 0) {
            uint256 availableReserve = zchf.calculateAssignedReserve(minted, reserveContribution);
            if (proceeds + availableReserve >= minted) {
                // we can repay everything
                uint256 returnedReserve = zchf.burnFromWithReserve(buyer, minted, reserveContribution);
                assert(returnedReserve == availableReserve);
                zchf.transferFrom(buyer, owner, proceeds + returnedReserve - minted);
                _notifyRepaid(minted);
            } else {
                // we can only repay a part
                zchf.transferFrom(buyer, address(this), proceeds);
                uint256 repaid = zchf.burnWithReserve(proceeds, reserveContribution);
                _notifyRepaid(repaid);
                // nothing to return to the owner
            }
        } else {
            // wire funds directly to owner
            zchf.transferFrom(buyer, owner, proceeds);
        }
        // send collateral to buyer
        collateral.transfer(buyer, collAmount);
        _considerClose(_collateralBalance());
        emit MintingUpdate(_collateralBalance(), price, minted);
    }

    /**
     * @notice Withdraw any ERC20 token that might have ended up on this address.
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
     * @notice Withdraw collateral from the position up to the extent that it is still well collateralized afterwards.
     * Not possible as long as there is an open challenge or the contract is subject to a cooldown.
     *
     * Withdrawing collateral below the minimum collateral amount formally closes the position.
     */
    function withdrawCollateral(address target, uint256 amount) public ownerOrRoller {
        uint256 balance = _withdrawCollateral(target, amount);
        emit MintingUpdate(balance, price, minted);
    }

    function _withdrawCollateral(address target, uint256 amount) internal noChallenge returns (uint256) {
        if (block.timestamp <= cooldown && !isClosed()) revert Hot();
        uint256 balance = _sendCollateral(target, amount);
        _checkCollateral(balance, price);
        if (balance < minimumCollateral && balance > 0) revert InsufficientCollateral(); // Prevent dust amounts
        return balance;
    }

    function _sendCollateral(address target, uint256 amount) internal returns (uint256) {
        if (amount > 0) {
            // Some weird tokens fail when trying to transfer 0 amounts
            IERC20(collateral).transfer(target, amount);
        }
        uint256 balance = _collateralBalance();
        _considerClose(balance);
        return balance;
    }

    function _considerClose(uint256 collateralBalance) internal {
        if (collateralBalance < minimumCollateral && challengedAmount == 0) {
            // This leaves a slightly unsatisfying possibility open: if the withdrawal happens due to a successful
            // challenge, there might be a small amount of collateral left that is not withheld in case there are no
            // other pending challenges. The only way to cleanly solve this would be to have two distinct cooldowns,
            // one for minting and one for withdrawals.
            _close();
        }
    }

    /**
     * @notice This invariant must always hold and must always be checked when any of the three
     * variables change in an adverse way.
     */
    function _checkCollateral(uint256 collateralReserve, uint256 atPrice) internal view {
        if (collateralReserve * atPrice < minted * ONE_DEC18) revert InsufficientCollateral();
    }

    /**
     * @notice Returns the liquidation price and the durations for phase1 and phase2 of the challenge.
     * Both phases are usually of equal duration, but near expiration, phase one is adjusted such that
     * it cannot last beyond the expiration date of the position.
     */
    function challengeData() external view returns (uint256 liqPrice, uint40 phase) {
        return (price, challengePeriod);
    }

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

        // If this was the last open challenge and there is only a dust amount of collateral left, the position should be closed
        _considerClose(_collateralBalance());
    }

    /**
     * @notice Notifies the position that a challenge was successful.
     * Triggers the payout of the challenged part of the collateral.
     * Everything else is assumed to be handled by the hub.
     *
     * @param _bidder   address of the bidder that receives the collateral
     * @param _size     amount of the collateral bid for
     * @return (position owner, effective challenge size in ZCHF, amount to be repaid, reserve ppm)
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
        uint256 repayment = colBal == 0 ? 0 : (minted * _size) / colBal; // for enormous colBal, this could be rounded to 0, which is ok
        _notifyRepaid(repayment); // we assume the caller takes care of the actual repayment

        // Give time for additional challenges before the owner can mint again. In particular,
        // the owner might have added collateral only seconds before the challenge ended, preventing a close.
        _restrictMinting(3 days);

        uint256 newBalance = _sendCollateral(_bidder, _size); // transfer collateral to the bidder and emit update

        emit MintingUpdate(newBalance, price, minted);

        return (owner, _size, repayment, reserveContribution);
    }
}

interface IHub {
    function rate() external view returns (ILeadrate);
    function roller() external view returns (address);
}
