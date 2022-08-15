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

    // should hopefully be grouped into one storage slot
    uint64 private totalVotesAnchorTime;
    uint192 private totalVotesAtAnchor;

    uint32 private constant QUORUM = 300;

    mapping (address => address) private delegates;
    mapping (address => uint64) private voteAnchor;

    IFrankencoin public zchf;

    event Delegation(address indexed from, address indexed to);

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
        if (amount > 0){
            uint256 roundingLoss = adjustRecipientVoteAnchor(to, amount);
            adjustTotalVotes(from, amount, roundingLoss);
        }
    }

     /**
     * @notice Decrease the total votes anchor when tokens lose their voting power due to being moved
     * @param from      sender
     * @param amount    amount to be sent
     */
    function adjustTotalVotes(address from, uint256 amount, uint256 roundingLoss) internal {
        uint256 lostVotes = from == address(0x0) ? 0 : (block.number - voteAnchor[from]) * amount;
        totalVotesAtAnchor = uint192(totalVotes() - roundingLoss - lostVotes);
        totalVotesAnchorTime = uint64(block.number);
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
            voteAnchor[to] = uint64(block.number - recipientVotes / newbalance); // new example anchor is only 21 / 11 = 1 block in the past
            return recipientVotes % newbalance; // we have lost 21 % 11 = 10 votes
        } else {
            // optimization for burn, vote anchor of null address does not matter
            return 0;
        }
    }

    function votes(address holder) public view returns (uint256) {
        return balanceOf(holder) * (block.number - voteAnchor[holder]);
    }

    function totalVotes() public view returns (uint256) {
        return totalVotesAtAnchor + totalSupply() * (block.number - totalVotesAnchorTime);
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
        return _votes * 10000 >= QUORUM * totalVotes();
    }

    function delegateVoteTo(address delegate) override external {
        delegates[msg.sender] = delegate;
        emit Delegation(msg.sender, delegate);
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
        assert(total + amount < 2**90);
        if (total == 0){
            // Initialization of first shares at 1:1
            _mint(from, amount);
        } else {
            _mint(from, amount * totalSupply() / (zchf.balanceOf(address(this)) - amount));
        }
        return true;
    }

    function redeemFraction(address target, uint256 partsPerMillion) override external returns (uint256){
        return redeem(target, partsPerMillion * balanceOf(msg.sender) / 1000000);
    }

    function redeem(address target, uint256 shares) override public returns (uint256) {
        uint256 proceeds = shares * zchf.balanceOf(address(this)) / totalSupply();
        _burn(msg.sender, shares);
        zchf.transfer(target, proceeds);
        require(zchf.reserveTargetFulfilled() || zchf.isMinter(msg.sender), "reserve requirement");
        return proceeds;
    }

    function redeemableBalance(address holder) override public view returns (uint256){
        return balanceOf(holder) * zchf.balanceOf(address(this)) / totalSupply();
    }

}