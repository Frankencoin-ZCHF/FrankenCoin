// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IReservePool.sol";
import "./IFrankencoin.sol";
import "./Ownable.sol";
import "./IERC677Receiver.sol";

/**
 * A simple collateralized minting contract.
 * This is a proof of concept that only allows one challenge at a time
 * and does not support fractional challenges.
 */
contract Position is Ownable, IERC677Receiver {

    uint256 public limit; // how much can be minted at most, including reserve
    uint256 public minted; // how much has been minted so far, including reserve

    IMintingHub public immutable hub;
    IFrankencoin public immutable zchf; // currency
    IERC20 public immutable collateral; // collateral

    uint32 public pendingChallenges;
    uint32 public immutable mintingFeePPM;
    uint32 public immutable reserveContribution;

    uint256 public immutable minChallenge;

    uint256 public immutable creation;
    uint256 public cooldown;
    uint256 public immutable expiration;

    event PositionOpened(address indexed hub, address indexed owner, address collateral, uint256 initialCollateral, uint256 initialLimit, uint256 duration, uint32 fees, uint32 reserve);
    event PositionDenied(address indexed sender, string message);
    event MintingUpdate(uint256 collateral, uint256 limit, uint256 minted);

    constructor(address owner, address _zchf, address _collateral, uint256 initialCollateral, uint256 initialLimit, uint256 duration, uint32 _mintingFeePPM, uint32 _reserve) Ownable(owner){
        hub = IMintingHub(msg.sender);
        zchf = IFrankencoin(_zchf);
        collateral = IERC20(_collateral);
        mintingFeePPM = _mintingFeePPM;
        reserveContribution = _reserve;
        expiration = block.timestamp + duration;
        creation = block.timestamp;
        minChallenge = initialCollateral / 10;
        hub.reserve().delegateVoteTo(owner);
        emit PositionOpened(msg.sender, owner, _collateral, initialCollateral, initialLimit, duration, _mintingFeePPM, _reserve);
    }

    function transferOwnership(address newOwner) override(Ownable) public {
        super.transferOwnership(newOwner);
        hub.reserve().delegateVoteTo(newOwner);
    }

    function deny(address[] calldata helpers, string calldata message) public {
        require(minted == 0, "minted");
        require(block.timestamp <= creation + 3 days, "too late");
        require(IReservePool(zchf.reserve()).isQualified(msg.sender, helpers), "not qualified");
        collateral.transfer(owner, collateral.balanceOf(address(this)));
        emit PositionDenied(msg.sender, message);
        selfdestruct(payable(owner));
    }

    /**
     * This is how much the minter can actually use when minting ZCHF, with the rest being used
     * to buy reserve pool shares.
     */
    function getUsableMint(uint256 totalMint, bool beforeFees) public view returns (uint256){
        uint256 usable = totalMint * (1000000 - reserveContribution) / 1000000;
        if (beforeFees){
            return usable;
        } else {
            return totalMint * (1000000 - mintingFeePPM) / 1000000;
        }
    }

    function pushlimit(uint256 newlimit) public onlyOwner noChallenge {
        if (newlimit > limit){
            restrictMinting(3 days);
        }
        limit = newlimit;
        emit MintingUpdate(IERC20(collateral).balanceOf(address(this)), limit, minted);
    }

    function mint(address target, uint256 amount) public onlyOwner noChallenge noMintRestriction {
        require(minted + amount <= limit);
        zchf.mint(target, amount, reserveContribution, mintingFeePPM);
        minted += amount;
        emit MintingUpdate(IERC20(collateral).balanceOf(address(this)), limit, minted);
    }

    function restrictMinting(uint256 period) internal {
        uint256 horizon = block.timestamp + period;
        if (horizon > cooldown){
            cooldown = horizon;
        }
    }
    
    function onTokenTransfer(address, uint256 amount, bytes calldata) external returns (bool){
        if (msg.sender == address(collateral)){
            handleCollateral(amount);
            return true;
        } else if (msg.sender == address(zchf)){
            repay();
            return true;
        } else {
            require(false);
            return false;
        }
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

    function repay(uint256 amount) public {
        IERC20(zchf).transferFrom(msg.sender, address(this), amount);
        repay();
    }

    function repay() public {
        uint256 outstanding = getOutstandingAmount();
        uint256 balance = IERC20(zchf).balanceOf(address(this));
        if (balance > outstanding){
            balance = outstanding;
        }
        balance += IReservePool(IFrankencoin(zchf).reserve()).redeemFraction(1000000 * balance / outstanding);
        if (balance > minted){
            balance = minted;
        }
        IFrankencoin(zchf).burn(balance, reserveContribution);
        minted -= balance;
        emit MintingUpdate(IERC20(collateral).balanceOf(address(this)), limit, minted);
    }

    function handleCollateral(uint256 amount) internal {
        uint256 balanceAfter = IERC20(collateral).balanceOf(address(this));
        if (balanceAfter > amount){
            // proportionally increase limit as collateral arrives
            limit = limit * balanceAfter / (balanceAfter - amount);
        }
        emit MintingUpdate(balanceAfter, limit, minted);
    }

    /**
     * Withdraw any token that might have ended up on this address, except for collateral
     * and reserve tokens, which also serve as a collateral.
     */
    function widthdraw(address token, address target, uint256 amount) external onlyOwner {
        require(token != zchf.reserve() || minted == 0); // if there are zchf, use them to repay first
        if (token == address(collateral)){
            require(pendingChallenges == 0, "challenges pending");
            uint256 current = IERC20(collateral).balanceOf(address(this));
            limit = limit * (current - amount) / current;
            require(minted <= limit);
            emit MintingUpdate(current - amount, limit, minted);
        }
        IERC20(token).transfer(target, amount);
    }

    function notifyChallengeStarted() external onlyHub {
        pendingChallenges++;
    }

    function tryAvertChallenge(uint256 size, uint256 bid) external onlyHub returns (bool) {
        if (block.timestamp >= expiration){
            return false; // position expired, let every challenge succeed
        } else if (bid * IERC20(collateral).balanceOf(address(this)) >= limit * size){
            // challenge averted, bid is high enough
            pendingChallenges--;
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
     *  - repay: the amount that is needed to repay for the acutally minted zchf wit the challenged collateral
     *  - minted: the number of zchf that where actually minted and used using the challenged collateral
     *  - mintmax: the maximum number of zchf that could have been minted and used using the challenged collateral 
     */
    function notifyChallengeSucceeded(address bidder, uint256 size) external onlyHub returns (uint256, uint256, uint256){
        pendingChallenges--;
        uint32 usagePPM = uint32(minted * 1000000 / limit);
        uint32 challengedPPM = uint32(size * 1000000 / IERC20(collateral).balanceOf(address(this)));

        IERC20(collateral).transfer(bidder, size);
        uint256 limitBefore = limit;
        limit = limit * challengedPPM / 1000000;
        uint256 challengedRange = (limitBefore - limit) * (1000000 - reserveContribution) / 1000000;
        return (getOutstandingAmount() * challengedPPM, challengedRange * usagePPM / 1000000, challengedRange);
    }

    modifier noMintRestriction() {
        require(cooldown < block.timestamp, "cooldown");
        _;
    }

    modifier noChallenge() {
        require(pendingChallenges == 0, "challenges pending");
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