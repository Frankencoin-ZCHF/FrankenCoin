// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IPosition.sol";
import "./IReserve.sol";
import "./IFrankencoin.sol";
import "./Ownable.sol";
import "./IERC677Receiver.sol";
import "./MathUtil.sol";

/**
 * A collateralized minting position.
 */
contract Position is Ownable, IERC677Receiver, IPosition, MathUtil {

    uint256 public price; // the zchf price per unit of the collateral below which challenges succeed
    uint256 public minted; // how much has been minted so far, including reserve
    uint256 public challengedAmount; // amount of the collateral that is currently under a challenge
    uint256 public immutable challengePeriod; //challenge period in timestamp units (seconds) for liquidation

    uint256 public cooldown;
    uint256 public limit; // how many zchf can be minted at most, including reserve
    uint256 public immutable expiration;

    address public immutable original; // originals point to themselves, clone to their origin
    address public immutable factory;
    address public immutable hub;
    IFrankencoin public immutable zchf; // currency
    IERC20 public override immutable collateral; // collateral
    uint256 public immutable minimumCollateral; // prevent dust amounts

    uint32 public immutable mintingFeePPM;
    uint32 public immutable reserveContribution; // in ppm

    event PositionOpened(address indexed hub, address indexed owner, 
        address collateral, uint256 initialCollateral, uint256 initialLimit, 
        uint256 duration, uint256 challengePeriod, uint32 fees, uint32 reserve);
    event PositionDenied(address indexed sender, string message);
    event MintingUpdate(uint256 collateral, uint256 price, uint256 minted, uint256 limit);

    /**
    * @param _owner             position owner address
    * @param _hub               address of minting hub
    * @param _zchf              ZCHF address
    * @param _collateral        collateral address
    * @param _minCollateral     minimum collateral required to prevent dust amounts
    * @param _initialCollateral amount of initial collateral to be deposited
    * @param _initialLimit      maximal amount of ZCHF that can be minted by the position owner (includes reserve)
    * @param _duration          position tenor in unit of timestamp (seconds) from 'now'
    * @param _challengePeriod   challenge period. Longer for less liquid collateral.
    * @param _mintingFeePPM     fee to enter position in parts per million of ZCHF amount
    * @param _liqPrice          Liquidation price (dec18) that together with the reserve and
    *                           fees determines the minimal collateralization ratio
    * @param _reservePPM        ZCHF pool reserve requirement in parts per million of ZCHF amount
    */
    constructor(address _owner, address _hub, address _zchf, address _collateral, 
        uint256 _minCollateral, uint256 _initialCollateral, 
        uint256 _initialLimit, uint256 _duration, uint256 _challengePeriod, uint32 _mintingFeePPM, 
        uint256 _liqPrice, uint32 _reservePPM) Ownable(_owner) 
    {
        factory = msg.sender;
        original = address(this);
        hub = _hub;
        price = _liqPrice;
        zchf = IFrankencoin(_zchf);
        collateral = IERC20(_collateral);
        mintingFeePPM = _mintingFeePPM;
        reserveContribution = _reservePPM;
        require(_initialCollateral >= _minCollateral);
        minimumCollateral = _minCollateral;
        expiration = block.timestamp + _duration;
        challengePeriod = _challengePeriod;
        restrictMinting(7 days);
        limit = _initialLimit;
        emit PositionOpened(_hub, owner, _collateral, _initialCollateral, 
            _initialLimit, _duration, _challengePeriod, _mintingFeePPM, _reservePPM);
    }

    function initializeClone(address owner, uint256 _price, uint256 _limit, uint256 _coll, uint256 _mint) external {
        require(msg.sender == address(factory), "factory only");
        require(_coll >= minimumCollateral, "coll not enough");
        transferOwnership(owner);
        
        price = _price;
        limit = _limit;
        mintInternal(owner, _mint, _coll);
    }

    /**
     * @notice adjust this position's limit to give away some limit to the clone
     *         invariant: global limit stays constant
     * @param _minimum  amount that clone wants to mint initially
     * @return limit for the clone
     */
    function reduceLimitForClone(uint256 _minimum) external noMintRestriction returns (uint256) {
        require(msg.sender == address(factory), "only factory");
        require(minted + _minimum <= limit, "limit exceeded");
        uint256 reduction = (limit - minted - _minimum)/2;
        limit -= reduction + _minimum;
        return reduction + _minimum;
    }

    function deny(address[] calldata helpers, string calldata message) public {
        require(minted == 0, "minted"); // must deny before any tokens are minted
        require(IReserve(zchf.reserve()).isQualified(msg.sender, helpers), "not qualified");
        collateral.transfer(owner, collateral.balanceOf(address(this)));
        zchf.transfer(owner, zchf.balanceOf(address(this)));
        cooldown = expiration;
        emit PositionDenied(msg.sender, message);
    }

    /**
     * This is how much the minter can actually use when minting ZCHF, with the rest being used
     * to buy reserve pool shares.
     */
    function getUsableMint(uint256 totalMint, bool beforeFees) public view returns (uint256){
        uint256 usable = totalMint * (1000_000 - reserveContribution) / 1000_000;
        if (beforeFees){
            return usable;
        } else {
            return totalMint * (1000_000 - mintingFeePPM) / 1000_000;
        }
    }

    // TODO Add function to push limit?

    function adjustPrice(uint256 newPrice) public onlyOwner noChallenge {
        if (newPrice > price) {
            restrictMinting(3 days);
        } else {
            require(isWellCollateralized(collateralBalance(), newPrice));
        }
        price = newPrice;
        emitUpdate();
    }

    function collateralBalance() internal view returns (uint256){
        return IERC20(collateral).balanceOf(address(this));
    }

    function mint(address target, uint256 amount) public onlyOwner noChallenge noMintRestriction {
        mintInternal(target, amount, collateralBalance());
    }

    function mintInternal(address target, uint256 amount, uint256 collateral_) internal {
        require(minted + amount <= limit, "limit exceeded");
        zchf.mint(target, amount, reserveContribution, mintingFeePPM);
        minted += amount;

        require(isWellCollateralized(collateral_, price), "not well collateralized");
        emitUpdate();
    }

    function restrictMinting(uint256 period) internal {
        uint256 horizon = block.timestamp + period;
        if (horizon > cooldown){
            cooldown = horizon;
        }
    }
    
    function onTokenTransfer(address, uint256 amount, bytes calldata) override external returns (bool) {
        if (msg.sender == address(zchf)){
            repayInternal(amount);
        } else {
            require(false);
        }
        return true;
    }

    function repay(uint256 amount) public onlyOwner {
        IERC20(zchf).transferFrom(msg.sender, address(this), amount);
        repayInternal(amount);
    }

    function repay() public onlyOwner {
        repayInternal(IERC20(zchf).balanceOf(address(this)));
    }

    function repayInternal(uint256 burnable) internal noChallenge {
        uint256 actuallyBurned = IFrankencoin(zchf).burnWithReserve(burnable, reserveContribution);
        notifyRepaidInternal(actuallyBurned);
    }

    function notifyRepaidInternal(uint256 amount) internal {
        require(amount <= minted);
        minted -= amount;
        emitUpdate();
    }

    /**
     * Withdraw any token that might have ended up on this address, except for collateral
     * and reserve tokens, which also serve as a collateral.
     */
    function withdraw(address token, address target, uint256 amount) external onlyOwner {
        if (token == address(collateral)){
            withdrawCollateral(target, amount);
        } else {
            IERC20(token).transfer(target, amount);
        }
    }

    function withdrawCollateral(address target, uint256 amount) public onlyOwner noChallenge {
        IERC20(collateral).transfer(target, amount);
        uint256 balance = collateralBalance();
        require(isWellCollateralized(balance, price));
        if (balance == 0){
            // Close
            cooldown = expiration;
        } else {
            require(balance >= minimumCollateral);
        }
        emitUpdate();
    }

    function isWellCollateralized(uint256 collateralReserve, uint256 atPrice) internal view returns (bool) {
        return collateralReserve * atPrice >= minted;
    }

    function emitUpdate() internal {
        emit MintingUpdate(collateralBalance(), price, minted, limit);
    }

    function notifyChallengeStarted(uint256 size) external onlyHub {
        uint256 colbal = collateralBalance();
        require(size <= colbal, "size exeeds collateral");
        require(colbal > 0, "no collateral"); // nothing to challenge
        require(size >= colbal / 20, "size too small"); // must challenge at least 5% of the position
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
            // don't allow minter to close the position immediately so challenge can be repeated
            restrictMinting(1 days);
            return true;
        } else {
            return false;
        }
    }

    /**
     * @notice Notifies the position that a challenge was successful.
     * Triggers the payout of the challenged part of the collateral.
     * Returns three important numbers:
     *  - repay: the amount that is needed to repay for the actually minted zchf wit the challenged collateral
     *  - minted: the number of zchf that where actually minted and used using the challenged collateral
     *  - mintmax: the maximum number of zchf that could have been minted and used using the challenged collateral 
     * @param _bidder   address of the bidder that receives the collateral
     * @param _bid      bid amount in ZCHF (dec18)
     * @param _size     size of the collateral bid for (dec 18)
     * @return adjusted bid size, repaied xchf, reserve contribution ppm
     */
    function notifyChallengeSucceeded(address _bidder, uint256 _bid, uint256 _size) 
        external onlyHub returns (uint256, uint256, uint32)
    {
        challengedAmount -= _size;
        uint256 volumeZCHF = _mulD18(price, _size);
        if (volumeZCHF > minted){
            _size = _divD18(_mulD18(_size, minted), volumeZCHF);
            _bid = _divD18(_mulD18(_bid, minted), volumeZCHF);
            volumeZCHF = minted;
        }
        require(_bid < volumeZCHF, "challenge not successful");
        // transfer collateral to the bidder
        IERC20(collateral).transfer(_bidder, _size);
        notifyRepaidInternal(volumeZCHF); // we assume the caller takes care of the actual repayment
        return (_bid, volumeZCHF, reserveContribution);
    }

    modifier noMintRestriction() {
       require(cooldown < block.timestamp, "cooldown");
       require(block.timestamp <= expiration, "expired");
        _;
    }

    modifier noChallenge() {
        require(challengedAmount == 0, "challenges pending");
        _;
    }

    modifier onlyHub() {
        require(msg.sender == address(hub), "not hub");
        _;
    }

}