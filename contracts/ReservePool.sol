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

    mapping (address => address) private delegates;

    IFrankencoin public zchf;

    constructor() ERC20(18){
    }

    function initialize(address frankencoin) external {
        require(address(zchf) == address(0x0));
        zchf = IFrankencoin(frankencoin);
    }

    function name() external pure returns (string memory) {
        return "Frankencoin Pool Share";
    }

    function symbol() external pure returns (string memory) {
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

    function isQualified(address sender, address[] calldata helpers) external view returns (bool) {
        uint256 votes = balanceOf(sender);
        for (uint i=0; i<helpers.length; i++){
            address current = helpers[i];
            require(current != sender);
            require(canVoteFor(sender, current));
            for (uint j=i+1; j<helpers.length; j++){
                require(current != helpers[j]);
            }
            votes += balanceOf(current);
        }
        return votes * 10000 >= QUORUM * totalSupply();
    }

    function delegateVoteTo(address delegate) external {
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
        require(msg.sender == address(zchf));
        uint256 total = totalSupply();
        if (total == 0){
            // Initialization of first shares at 1:1
            _mint(from, amount);
        } else {
            _mint(from, amount * totalSupply() / (zchf.balanceOf(address(this)) - amount));
        }
        return true;
    }

    function redeemFraction(uint256 partsPerMillion) external returns (uint256){
        return redeem(partsPerMillion * balanceOf(msg.sender) / 1000000);
    }

    function redeem(uint256 shares) public returns (uint256) {
        uint256 proceeds = shares * zchf.balanceOf(address(this)) / totalSupply();
        _burn(msg.sender, shares);
        zchf.transfer(msg.sender, proceeds);
        require(zchf.reserveTargetFulfilled() || zchf.isMinter(msg.sender), "reserve requirement");
        return proceeds;
    }

    function redeemableBalance(address holder) public view returns (uint256){
        return balanceOf(holder) * zchf.balanceOf(address(this)) / totalSupply();
    }


}