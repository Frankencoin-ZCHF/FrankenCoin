// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IPosition.sol";
import "./IReserve.sol";
import "./IFrankencoin.sol";
import "./Ownable.sol";
import "./IERC677Receiver.sol";

/**
 * A collateralized minting position.
 */
contract Position is Ownable, IERC677Receiver, IPosition {

    uint256 public price; // the zchf price per unit of the collateral below which challenges succeed
    uint256 public minted; // how much has been minted so far, including reserve
    uint256 public challengedAmount;

    uint256 public cooldown;
    uint256 public limit; // how many zchf can be minted at most, including reserve
    uint256 public immutable expiration;

    address public immutable original;
    address public immutable factory;
    address public immutable hub;
    IFrankencoin public immutable zchf; // currency
    IERC20 public override immutable collateral; // collateral
    uint256 public immutable minimumCollateral; // prevent dust amounts

    uint32 public immutable mintingFeePPM;
    uint32 public immutable reserveContribution; // in ppm

    event PositionOpened(address indexed hub, address indexed owner, address collateral, uint256 initialCollateral, uint256 initialLimit, uint256 duration, uint32 fees, uint32 reserve);
    event PositionDenied(address indexed sender, string message);
    event MintingUpdate(uint256 collateral, uint256 price, uint256 minted, uint256 limit);

    constructor(address owner, address _hub, address _zchf, address _collateral, 
        uint256 _minCollateral, uint256 initialCollateral, 
        uint256 initialLimit, uint256 duration, uint32 _mintingFeePPM, 
        uint32 _reserve) Ownable(owner) 
    {
        factory = msg.sender;
        original = address(this);
        hub = _hub;
        zchf = IFrankencoin(_zchf);
        collateral = IERC20(_collateral);
        mintingFeePPM = _mintingFeePPM;
        reserveContribution = _reserve;
        require(initialCollateral >= _minCollateral);
        minimumCollateral = _minCollateral;
        expiration = block.timestamp + duration;
        restrictMinting(7 days);
        limit = initialLimit;
        emit PositionOpened(_hub, owner, _collateral, initialCollateral, initialLimit, duration, _mintingFeePPM, _reserve);
    }

    function initializeClone(address owner, uint256 price_, uint256 limit_, uint256 coll, uint256 mint_) external {
        require(msg.sender == address(factory));
        require(coll >= minimumCollateral);
        transferOwnership(owner);
        price = price_;
        limit = limit_;
        mintInternal(owner, mint_, coll);
    }

    function reduceLimitForClone(uint256 minimum) external noMintRestriction returns (uint256) {
        require(msg.sender == address(factory));
        require(minted + minimum <= limit);
        uint256 reduction = (limit - minted - minimum)/2;
        limit -= reduction;
        return reduction + minimum;
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
        require(minted + amount <= limit);
        zchf.mint(target, amount, reserveContribution, mintingFeePPM);
        minted += amount;
        require(isWellCollateralized(collateral_, price));
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
        require(colbal > 0); // nothing to challenge
        require(size >= colbal / 20); // must challenge at least 5% of the position
        challengedAmount += price * size;
    }

    function tryAvertChallenge(uint256 size, uint256 bid) external onlyHub returns (bool) {
        if (block.timestamp >= expiration){
            return false; // position expired, let every challenge succeed
        } else if (bid >= price * size){
            // challenge averted, bid is high enough
            challengedAmount -= price * size;
            // don't allow minter to close the position immediately so challenge can be repeated
            restrictMinting(1 days);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Notifies the position that a challenge was successful.
     * Triggers the payout of the challenged part of the collateral.
     * Returns three important numbers:
     *  - repay: the amount that is needed to repay for the actually minted zchf wit the challenged collateral
     *  - minted: the number of zchf that where actually minted and used using the challenged collateral
     *  - mintmax: the maximum number of zchf that could have been minted and used using the challenged collateral 
     */
    function notifyChallengeSucceeded(address bidder, uint256 bid, uint256 size) external onlyHub returns (uint256, uint256, uint32){
        uint256 volume = price * size;
        challengedAmount -= volume;
        if (volume > minted){
            volume = minted;
            size = size * minted / volume;
            bid = bid * minted / volume;
        }
        assert(bid <= volume);
        // transfer collateral to the bidder
        IERC20(collateral).transfer(bidder, size);
        notifyRepaidInternal(volume); // we assume the caller takes care of the actual repayment
        return (bid, volume, reserveContribution);
    }

    modifier noMintRestriction() {
        require(cooldown < block.timestamp && block.timestamp <= expiration, "cooldown");
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