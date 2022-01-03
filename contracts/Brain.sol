// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import "./IFrankencoin.sol";
import "./IERC677Receiver.sol";
import "./ERC20.sol";

/** 
 * @title Governance contract for ZCHF
 * @dev 
 */
contract Brain is ERC20 {

    uint256 public constant ADOPTION_PERIOD = 4 weeks;

    uint32 private quorumBips = 500;
    uint32 private quorumOld = 0;
    uint256 private quorumTime = block.timestamp;

    uint256 private zomPrice = 1*(10**18); // in ZCHF base units
    uint256 private zomPriceOld = 0; // in ZCHF base units
    uint256 private zomPriceTime = block.timestamp;

    IFrankencoin public immutable zchf;

    constructor(address zchfAddress) ERC20(18){
        zchf = IFrankencoin(zchfAddress);
    }

    function name() external pure returns (string memory) {
        return "Frankencoin Brain";
    }

    function symbol() external pure returns (string memory) {
        return "ZOM";
    }

    function price(uint256 timestamp) public view returns (uint256){
        if (timestamp >= zomPriceTime){
            return zomPrice;
        } else {
            uint256 time = zomPriceTime - timestamp;
            return (zomPrice*time + (ADOPTION_PERIOD-time)*zomPriceOld)/ADOPTION_PERIOD;
        }
    }

    function setPriceTarget(uint256 target) external qualified {
        zomPriceOld = price(block.timestamp);
        require((zomPriceOld <= target * 2) && (target <= zomPriceOld * 2));
        zomPrice = target;
        zomPriceTime = block.timestamp + ADOPTION_PERIOD;
    }

    function quorum(uint256 timestamp) public view returns (uint32){
        if (timestamp >= zomPriceTime){
            return quorumBips;
        } else {
            uint256 time = quorumTime - timestamp;
            return uint32((quorumBips*time + (ADOPTION_PERIOD-time)*quorumOld)/ADOPTION_PERIOD);
        }
    }
    
    function setQuorum(uint32 target) external qualified {
        quorumOld = quorum(block.timestamp);
        require(target <= 10000);
        quorumBips = target;
        quorumTime = block.timestamp + ADOPTION_PERIOD;
    }

    modifier qualified {
        require(balanceOf(msg.sender) * 10000 >= quorum(block.timestamp) * zchf.totalSupply(), "not enough votes");
        _;
    }

    function veto(address minter) external qualified {
        zchf.denyMinter(minter);
    }

    function decide(address target, bytes calldata data) external qualified returns (bool success, bytes memory returndata) {
        require(target != address(zchf)); // don't allow to transfer Frankencoins out of the reserve
        return target.call(data);
    }

    function onTokenTransfer(address from, uint256 amount, bytes calldata) external returns (bool) {
        require(msg.sender == address(zchf));
        _mint(from, amount * 10**18 / price(block.timestamp));
        return true;
    }

    function cashout(uint256 amount) external {
        _burn(msg.sender, amount);
        uint256 proceeds = amount * price(block.timestamp) / (10**18);
        require(zchf.excessReserves() >= proceeds);
        zchf.transfer(msg.sender, proceeds);
    }

}