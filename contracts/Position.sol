// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IPosition.sol";
import "./IReserve.sol";
import "./IFrankencoin.sol";
import "./Ownable.sol";
import "./MathUtil.sol";

/**
 * A collateralized minting position.
 */
contract Position is Ownable, IPosition, MathUtil {

    /**
     * Note that this contract is intended to be cloned. All clones will share the same values for
     * the constant and immutable fields, but have their own values for the other fields.
     */

    uint256 public price; // the zchf price per unit of the collateral below which challenges succeed, (36 - collateral.decimals) decimals
    uint256 public minted; // net minted amount, including reserve
    uint256 public challengedAmount; // amount of the collateral that is currently under a challenge
    uint256 public immutable challengePeriod; // challenge period in seconds

    uint256 public cooldown; // timestamp of the end of the latest cooldown
    uint256 public limit; // the minted amount must never exceed the limit

    uint256 public immutable start; // timestamp when minting can start
    uint256 public immutable expiration; // timestamp at which the position expires

    address public immutable original; // originals point to themselves, clone to their origin
    address public immutable hub; // the hub this position was created by
    IFrankencoin public immutable zchf; // currency
    IERC20 public override immutable collateral; // collateral
    uint256 public override immutable minimumCollateral; // prevent dust amounts

    uint32 public immutable mintingFeePPM;
    uint32 public immutable reserveContribution; // in ppm

    event PositionOpened(address indexed owner, address original, address zchf, address collateral, uint256 price);
    event MintingUpdate(uint256 collateral, uint256 price, uint256 minted, uint256 limit);
    event PositionDenied(address indexed sender, string message); // emitted if closed by governance

    error InsufficientCollateral();

    /**
    * See MintingHub.openPosition
    */
    constructor(address _owner, address _hub, address _zchf, address _collateral, 
        uint256 _minCollateral, uint256 _initialCollateral, 
        uint256 _initialLimit, uint256 _duration, uint256 _challengePeriod, uint32 _mintingFeePPM, 
        uint256 _liqPrice, uint32 _reservePPM) {
        setOwner(_owner);
        original = address(this);
        hub = _hub;
        price = _liqPrice;
        zchf = IFrankencoin(_zchf);
        collateral = IERC20(_collateral);
        mintingFeePPM = _mintingFeePPM;
        reserveContribution = _reservePPM;
        if(_initialCollateral < _minCollateral) revert InsufficientCollateral();
        minimumCollateral = _minCollateral;
        challengePeriod = _challengePeriod;
        start = block.timestamp + 7 days; // one week time to deny the position
        cooldown = start;
        expiration = start + _duration;
        limit = _initialLimit;
        
        emit PositionOpened(_owner, original, _zchf, address(collateral), _liqPrice);
    }

    /**
     * Method to initialize a freshly created clone. It is the responsibility of the creator to make sure this is only
     * called once and to call reduceLimitForClone on the original position before initializing the clone.
     */
    function initializeClone(address owner, uint256 _price, uint256 _limit, uint256 _coll, uint256 _mint) external onlyHub {
        if(_coll < minimumCollateral) revert InsufficientCollateral();
        setOwner(owner);
        
        price = _mint * ONE_DEC18 / _coll;
        if (price > _price) revert InsufficientCollateral();
        limit = _limit;
        mintInternal(owner, _mint, _coll);

        emit PositionOpened(owner, original, address(zchf), address(collateral), _price);
    }

    /**
     * Adjust this position's limit to give away half of the remaining limit to the clone.
     * Invariant: global limit stays the same.
     *
     * Cloning a position is only allowed if the position is not challenged, not expired and not in cooldown.
     *
     * @param _minimum amount that clone wants to mint initially
     * @return limit for the clone
     */
    function reduceLimitForClone(uint256 _minimum) external noChallenge noCooldown alive onlyHub returns (uint256) {
        uint256 reduction = (limit - minted - _minimum)/2; // this will fail with an underflow if minimum is too high
        limit -= reduction + _minimum;
        return reduction + _minimum;
    }

    error TooLate();
    error NotQualified();

    /**
     * Qualified pool share holders can call this method to immediately expire a freshly proposed position.
     */ 
    function deny(address[] calldata helpers, string calldata message) public {
        if (block.timestamp >= start) revert TooLate();
        IReserve(zchf.reserve()).checkQualified(msg.sender, helpers);
        cooldown = expiration; // since expiration is immutable, we put it under cooldown until the end
        emit PositionDenied(msg.sender, message);
    }

    /**
     * This is how much the minter can actually use when minting ZCHF, with the rest being used
     * to buy reserve pool shares.
     */
    function getUsableMint(uint256 totalMint, bool afterFees) public view returns (uint256){
        if (afterFees){
            return totalMint * (1000_000 - reserveContribution - calculateCurrentFee()) / 1000_000;
        } else {
            return totalMint * (1000_000 - reserveContribution) / 1000_000;
        }
    }

    /**
     * "All in one" function to adjust the outstanding amount of ZCHF, the collateral amount, 
     * and the price in one transaction.
     */
    function adjust(uint256 newMinted, uint256 newCollateral, uint256 newPrice) public onlyOwner {
        if (newPrice != price){
            adjustPrice(newPrice);
        }
        uint256 colbal = collateralBalance();
        if (newCollateral > colbal){
            collateral.transferFrom(msg.sender, address(this), newCollateral - colbal);
        }
        // Must be called after collateral deposit, but before withdrawal
        if (newMinted < minted){
            zchf.burnFrom(msg.sender, minted - newMinted, reserveContribution);
            minted = newMinted;
        }
        if (newCollateral < colbal){
            withdrawCollateral(msg.sender, colbal - newCollateral);
        }
        // Must be called after collateral withdrawal
        if (newMinted > minted){
            mint(msg.sender, newMinted - minted);
        }
    }

    /**
     * Allows the position owner to adjust the liquidation price as long as there is no pending challenge.
     * Lowering the liquidation price can be done with immediate effect, given that there is enough collateral.
     * Increasing the liquidation price triggers a cooldown period of 3 days, during which minting is suspended.
     */
    function adjustPrice(uint256 newPrice) public onlyOwner noChallenge {
        if (newPrice > price) {
            restrictMinting(3 days);
        } else {
            checkCollateral(collateralBalance(), newPrice);
        }
        price = newPrice;
        emitUpdate();
    }

    function collateralBalance() internal view returns (uint256){
        return IERC20(collateral).balanceOf(address(this));
    }

    /**
     * Mint ZCHF as long as there is no open challenge, the position is not subject to a cooldown,
     * and there is sufficient collateral.
     */
    function mint(address target, uint256 amount) public onlyOwner noChallenge noCooldown alive {
       mintInternal(target, amount, collateralBalance());
    }

    function calculateCurrentFee() public view returns (uint32) {
        uint256 exp = expiration;
        uint256 time = block.timestamp;
        if (time >= exp){
            return 0;
        } else {
            return uint32(mintingFeePPM - mintingFeePPM * (time - start) / (exp - start));
        }
    }

    error LimitExceeded();

    function mintInternal(address target, uint256 amount, uint256 collateral_) internal {
        if (minted + amount > limit) revert LimitExceeded();
        zchf.mint(target, amount, reserveContribution, calculateCurrentFee());
        minted += amount;

        checkCollateral(collateral_, price);
        emitUpdate();
    }

    function restrictMinting(uint256 period) internal {
        uint256 horizon = block.timestamp + period;
        if (horizon > cooldown){
            cooldown = horizon;
        }
    }
    
    /**
     * Repay some ZCHF. Requires an allowance to be in place. If too much is repaid, the call fails.
     * It is possible to repay while there are challenges, but the collateral is locked until all is clear again.
     *
     * The repaid amount should fulfill the following equation in order to close the position, i.e. bring the minted amount to 0:
     * minted = amount + zchf.calculateAssignedReserve(amount, reservePPM)
     *
     * Under normal circumstances, this implies:
     * amount = minted * (1000000 - reservePPM)
     *
     * For example, if minted is 50 and reservePPM is 200000, it is necessary to repay 40 to be able to close the position.
     *
     * Only the owner is allowed to repay a position. This is necessary to prevent a 'limit stealing attack': if a popular position
     * has reached its limit, an attacker could try to repay the position, clone it, and take a loan himself. This is prevented by
     * requiring the owner to do the repayment. Other restrictions are not necessary. In particular, it must be possible to repay
     * the position once it is expired or subject to cooldown. Also, repaying it during a challenge is no problem as the collateral
     * remains present.
     */
    function repay(uint256 amount) public onlyOwner {
        IERC20(zchf).transferFrom(msg.sender, address(this), amount);
        repayInternal(amount);
    }

    function repayInternal(uint256 burnable) internal {
        uint256 actuallyBurned = IFrankencoin(zchf).burnWithReserve(burnable, reserveContribution);
        notifyRepaidInternal(actuallyBurned);
        emitUpdate();
    }

    error RepaidTooMuch(uint256 excess);

    function notifyRepaidInternal(uint256 amount) internal {
        if (amount > minted) revert RepaidTooMuch(amount - minted);
        minted -= amount;
    }

    /**
     * Withdraw any ERC20 token that might have ended up on this address.
     * Withdrawing collateral is subject to the same restrictions as withdrawCollateral(...).
     */
    function withdraw(address token, address target, uint256 amount) external onlyOwner {
        if (token == address(collateral)){
            withdrawCollateral(target, amount);
        } else {
            IERC20(token).transfer(target, amount);
        }
    }

    /**
     * Withdraw collateral from the position up to the extent that it is still well collateralized afterwards.
     * Not possible as long as there is an open challenge or the contract is subject to a cooldown.
     *
     * Withdrawing collateral below the minimum collateral amount formally closes the position.
     */
    function withdrawCollateral(address target, uint256 amount) public onlyOwner noChallenge noCooldown {
        uint256 balance = internalWithdrawCollateral(target, amount);
        checkCollateral(balance, price);
    }

    function internalWithdrawCollateral(address target, uint256 amount) internal returns (uint256) {
        IERC20(collateral).transfer(target, amount);
        uint256 balance = collateralBalance();
        if (balance < minimumCollateral){
            cooldown = expiration;
        }
        emitUpdate();
        return balance;
    }

    /**
     * This invariant must always hold and must always be checked when any of the three
     * variables change in an adverse way.
     */
    function checkCollateral(uint256 collateralReserve, uint256 atPrice) internal view {
        if (collateralReserve * atPrice < minted * ONE_DEC18) revert InsufficientCollateral();
    }

    function emitUpdate() internal {
        emit MintingUpdate(collateralBalance(), price, minted, limit);
    }

    error ChallengeTooSmall();

    function notifyChallengeStarted(uint256 size) external onlyHub {
        // require minimum size, note that collateral balance can be below minimum if it was partially challenged before
        if (size < minimumCollateral && size < collateralBalance()) revert ChallengeTooSmall();
        challengedAmount += size;
    }

    /**
     * @notice check whether challenge can be averted
     * @param _collateralAmount   amount of collateral challenged (dec18)
     * @param _bidAmountZCHF      bid amount in ZCHF (dec18)
     * @return true if challenge can be averted
     */
    function tryAvertChallenge(uint256 _collateralAmount, uint256 _bidAmountZCHF) external onlyHub returns (bool) {
        if (block.timestamp >= expiration){
            return false; // position expired, let every challenge succeed
        } else if (_bidAmountZCHF * ONE_DEC18 >= price * _collateralAmount){
            // challenge averted, bid is high enough
            challengedAmount -= _collateralAmount;
            // Don't allow minter to close the position immediately so challenge can be repeated before
            // the owner has a chance to mint more on an undercollateralized position
            restrictMinting(1 days);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Notifies the position that a challenge was successful.
     * Triggers the payout of the challenged part of the collateral.
     * Everything else is assumed to be handled by the hub.
     *
     * @param _bidder   address of the bidder that receives the collateral
     * @param _bid      bid amount in ZCHF (dec18)
     * @param _size     size of the collateral bid for (dec 18)
     * @return (position owner, effective bid size in ZCHF, effective challenge size in ZCHF, repaid amount, reserve ppm)
     */
    function notifyChallengeSucceeded(address _bidder, uint256 _bid, uint256 _size) external onlyHub returns (address, uint256, uint256, uint256, uint32) {
        challengedAmount -= _size;
        uint256 colBal = collateralBalance();
        if (_size > colBal){
            // Challenge is larger than the position. This can for example happen if there are multiple concurrent
            // challenges that exceed the collateral balance in size. In this case, we need to redimension the bid and
            // tell the caller that a part of the bid needs to be returned to the bidder.
            _bid = _divD18(_mulD18(_bid, colBal), _size);
            _size = colBal;
        }

        // Note that thanks to the collateral invariant, we know that
        //    colBal * price >= minted * ONE_DEC18
        // and that therefore
        //    price >= minted / colbal * E18
        // such that
        //    volumeZCHF = price * size / E18 >= minted * size / colbal
        // So the owner cannot maliciously decrease the price to make volume fall below the proportionate repayment.
        uint256 volumeZCHF = _mulD18(price, _size); // How much could have minted with the challenged amount of the collateral
        // The owner does not have to repay (and burn) more than the owner actually minted.  
        uint256 repayment = minted < volumeZCHF ? minted : volumeZCHF; // how much must be burned to make things even

        notifyRepaidInternal(repayment); // we assume the caller takes care of the actual repayment
        internalWithdrawCollateral(_bidder, _size); // transfer collateral to the bidder and emit update
        return (owner, _bid, volumeZCHF, repayment, reserveContribution);
    }

    /**
     * A position should only be considered 'closed', once its collateral has been withdrawn.
     * This is also a good creterion when deciding whether it should be shown in a frontend.
     */
    function isClosed() public view returns (bool) {
        return collateralBalance() < minimumCollateral;
    }

    error Expired();

    modifier alive() {
        if (block.timestamp > expiration) revert Expired();
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