// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IReservePool.sol";
import "./IFrankencoin.sol";
import "./Ownable.sol";
import "./IERC677Receiver.sol";

/**
 * A collateralized minting position.
 */
contract Position is Ownable, IERC677Receiver {

    uint256 public price; // the zchf price per unit of the collateral below which challenges succeed
    uint256 public immutable limit; // how many zchf can be minted at most, including reserve
    uint256 public minted; // how much has been minted so far, including reserve

    IMintingHub public immutable hub;
    IFrankencoin public immutable zchf; // currency
    IERC20 public immutable collateral; // collateral

    uint256 public challengedAmount;
    uint32 public immutable mintingFeePPM;
    uint32 public immutable reserveContribution; // in ppm

    uint256 public cooldown;
    uint256 public immutable expiration;

    event PositionOpened(address indexed hub, address indexed owner, address collateral, uint256 initialCollateral, uint256 initialLimit, uint256 duration, uint32 fees, uint32 reserve);
    event PositionDenied(address indexed sender, string message);
    event MintingUpdate(uint256 collateral, uint256 price, uint256 minted, uint256 limit);

    constructor(address owner, address _zchf, address _collateral, uint256 initialCollateral, 
        uint256 initialLimit, uint256 duration, uint32 _mintingFeePPM, uint32 _reserve) Ownable(owner) {
        hub = IMintingHub(msg.sender);
        zchf = IFrankencoin(_zchf);
        collateral = IERC20(_collateral);
        mintingFeePPM = _mintingFeePPM;
        reserveContribution = _reserve;
        expiration = block.timestamp + duration;
        restrictMinting(7 days);
        limit = initialLimit;
        IMintingHub(msg.sender).reserve().delegateVoteTo(owner);
        emit PositionOpened(msg.sender, owner, _collateral, initialCollateral, initialLimit, duration, _mintingFeePPM, _reserve);
    }

    function transferOwnership(address newOwner) override(Ownable) public {
        super.transferOwnership(newOwner);
        hub.reserve().delegateVoteTo(newOwner);
    }

    function deny(address[] calldata helpers, string calldata message) public {
        require(minted == 0, "minted"); // must deny before any tokens are minted
        require(IReservePool(zchf.reserve()).isQualified(msg.sender, helpers), "not qualified");
        collateral.transfer(owner, collateral.balanceOf(address(this)));
        zchf.transfer(owner, zchf.balanceOf(address(this)));
        IERC20(zchf.reserve()).transfer(owner, IERC20(zchf.reserve()).balanceOf(address(this)));
        emit PositionDenied(msg.sender, message);
        selfdestruct(payable(owner));
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

    function adjustPrice(uint256 newPrice) public onlyOwner noChallenge {
        if (newPrice > price) {
            restrictMinting(3 days);
        } else {
            require(isWellCollateralized(newPrice));
        }
        price = newPrice;
        emitUpdate();
    }

    function collateralBalance() internal view returns (uint256){
        return IERC20(collateral).balanceOf(address(this));
    }

    function mint(address target, uint256 amount) public onlyOwner noChallenge noMintRestriction {
        require(minted + amount <= limit);
        zchf.mint(target, amount, reserveContribution, mintingFeePPM);
        minted += amount;
        require(isWellCollateralized(price));
        emitUpdate();
    }

    function restrictMinting(uint256 period) internal {
        uint256 horizon = block.timestamp + period;
        if (horizon > cooldown){
            cooldown = horizon;
        }
    }
    
    function onTokenTransfer(address sender, uint256 amount, bytes calldata) override external returns (bool) {
        if (msg.sender == address(zchf)){
            require(sender == owner);
            repayInternal(amount);
        } else {
            require(false);
        }
        return true;
    }

    /**
     * The amount that must be paid to close the position for good.
     */
    function getOutstandingAmount() public view returns (uint256){
        uint256 reserveBalance = IReservePool(zchf.reserve()).redeemableBalance(address(this));
        if (reserveBalance > minted){
            return 0;
        } else {
            return minted - reserveBalance;
        }
    }

    function repay(uint256 amount) public onlyOwner {
        IERC20(zchf).transferFrom(msg.sender, address(this), amount);
        repayInternal(amount);
    }

    function repay() public onlyOwner {
        repayInternal(IERC20(zchf).balanceOf(address(this)));
    }

    function repayInternal(uint256 burnable) internal noChallenge {
        require(burnable <= minted);
        IFrankencoin(zchf).burn(burnable, reserveContribution);
        minted -= burnable;
        emitUpdate();
    }

    /**
     * Withdraw any token that might have ended up on this address, except for collateral
     * and reserve tokens, which also serve as a collateral.
     */
    function withdraw(address token, address target, uint256 amount) external onlyOwner {
        if (token == zchf.reserve()){
            uint256 requiredPoolShareValue = minted * reserveContribution / 1000000;
            uint256 actualPoolShareValue = IReservePool(zchf.reserve()).redeemableBalance(address(this));
            if (requiredPoolShareValue < actualPoolShareValue){
                uint256 redeemableShares = (actualPoolShareValue - requiredPoolShareValue) * IERC20(zchf.reserve()).balanceOf(address(this)) / actualPoolShareValue;
                require(amount <= redeemableShares, "not enough free pool shares");
                IERC20(token).transfer(target, amount);
            } else {
                require(false);
            }
        } else if (token == address(collateral)){
            withdrawCollateral(target, amount);
        } else {
            IERC20(token).transfer(target, amount);
        }
    }

    function withdrawCollateral(address target, uint256 amount) public onlyOwner noChallenge {
        IERC20(collateral).transfer(target, amount);
        require(isWellCollateralized(price));
        emitUpdate();
    }

    function isWellCollateralized(uint256 atPrice) internal view returns (bool) {
        return collateralBalance() * atPrice >= minted;
    }

    function emitUpdate() internal {
        emit MintingUpdate(collateralBalance(), price, minted, limit);
    }

    function notifyChallengeStarted(uint256 size) external onlyHub {
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
    function notifyChallengeSucceeded(address bidder, uint256 bid, uint256 size) external onlyHub returns (uint256, uint256, uint256){
        uint256 volume = price * size;
        challengedAmount -= volume;
        if (volume > minted){
            volume = minted;
            size = size * minted / volume;
            bid = bid * minted / volume;
        }
        // transfer collateral to the bidder
        IERC20(collateral).transfer(bidder, size);
        uint32 challengedPPM = uint32((volume) * 1000000 / minted);
        uint256 redeemed = IReservePool(zchf.reserve()).redeemFraction(address(hub), challengedPPM);
        return (bid, volume, redeemed);
    }

    modifier noMintRestriction() {
        require(cooldown < block.timestamp, "cooldown");
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

interface IMintingHub {

    function reserve() external returns (IReservePool);
}