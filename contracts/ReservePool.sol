// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import "./IFrankencoin.sol";
import "./IERC677Receiver.sol";
import "./ERC20.sol";
import "./IReservePool.sol";

/** 
 * @title Reserve pool for the Frankencoin
 */
contract ReservePool is ERC20, IReservePool {

    uint32 private constant QUORUM = 300;
    uint64 private totalVoteAnchor;

    mapping (address => address) private delegates;
    mapping (address => uint64) private voteAnchor;

    IFrankencoin public zchf;

    constructor() ERC20(18){
    }

    function initialize(address frankencoin) external {
        require(address(zchf) == address(0x0));
        zchf = IFrankencoin(frankencoin);
    }

    function name() override external pure returns (string memory) {
        return "Frankencoin Pool Share";
    }

    function symbol() override external pure returns (string memory) {
        return "FPS";
    }

    function price() public view returns (uint256){
        uint256 balance = zchf.balanceOf(address(this));
        if (balance == 0){
            return 0;
        } else {
            return balance / totalSupply();
        }
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) override internal {
        super._beforeTokenTransfer(from, to, amount);
        adjustSenderVoteAnchor(from, amount);
        adjustRecipientVoteAnchor(to, amount);
    }

     /**
     * @notice Liquidity provision changes when tokens are sent or burnt,
     *  hence we adjust totalVoteAnchor 
     * @dev when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
     *      will be to transferred to `to`
     *      when `from` is zero, `amount` tokens will be minted for `to`.
     *      when `to` is zero, `amount` of ``from``'s tokens will be burned.
     * @param from      sender
     * @param amount    amount to be sent
     */
    function adjustSenderVoteAnchor(address from, uint256 amount) internal {
        if (from==address(0)) {
            return;
        }
        uint256 lostVotes = votes(from) * amount / balanceOf(from);
        totalVoteAnchor = uint64(block.number - (totalVotes() - lostVotes) / totalSupply());
    }

    
    /**
     * @notice age is adjusted such that the vote count stays constant when receiving tokens
     * @dev when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
     *      will be to transferred to `to`
     *      when `from` is zero, `amount` tokens will be minted for `to`.
     *      when `to` is zero, `amount` of ``from``'s tokens will be burned.
     * @param to        receiver address
     * @param amount    amount to be received
     */
    function adjustRecipientVoteAnchor(address to, uint256 amount) internal {
        if (to==address(0)) {
            return;
        }
        voteAnchor[to] = uint64(block.number - (votes(to) / (balanceOf(to) + amount)));
    }

    function votes(address holder) public view returns (uint256) {
        return balanceOf(holder) * (block.number - voteAnchor[holder]);
    }

    function totalVotes() public view returns (uint256) {
        return totalSupply() * (block.number - totalVoteAnchor);
    }

    function isQualified(address sender, address[] calldata helpers) external override view returns (bool) {
        uint256 _votes = votes(sender);
        for (uint i=0; i<helpers.length; i++){
            address current = helpers[i];
            require(current != sender);
            require(canVoteFor(sender, current));
            for (uint j=i+1; j<helpers.length; j++){
                require(current != helpers[j]);
            }
            _votes += votes(current);
        }
        return _votes * 10000 >= QUORUM * totalSupply();
    }

    function delegateVoteTo(address delegate) override external {
        delegates[msg.sender] = delegate;
    }

    function canVoteFor(address delegate, address owner) public view returns (bool) {
        if (owner == delegate){
            return true;
        } else if (owner == address(0x0)){
            return false;
        } else {
            return canVoteFor(delegate, delegates[owner]);
        }
    }

    function onTokenTransfer(address from, uint256 amount, bytes calldata) external returns (bool) {
        require(msg.sender == address(zchf), "caller must be zchf");
        uint256 total = totalSupply();
        adjustRecipientVoteAnchor(from, amount);
        if (total == 0){
            // Initialization of first shares at 1:1
            _mint(from, amount);
        } else {
            _mint(from, amount * totalSupply() / (zchf.balanceOf(address(this)) - amount));
        }
        return true;
    }

    function redeemFraction(uint256 partsPerMillion) override external returns (uint256){
        return redeem(partsPerMillion * balanceOf(msg.sender) / 1000000);
    }

    function redeem(uint256 shares) override public returns (uint256) {
        uint256 proceeds = shares * zchf.balanceOf(address(this)) / totalSupply();
        adjustSenderVoteAnchor(msg.sender, shares);
        _burn(msg.sender, shares);
        zchf.transfer(msg.sender, proceeds);
        require(zchf.reserveTargetFulfilled() || zchf.isMinter(msg.sender), "reserve requirement");
        return proceeds;
    }

    function redeemableBalance(address holder) override public view returns (uint256){
        return balanceOf(holder) * zchf.balanceOf(address(this)) / totalSupply();
    }

}