// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import "./Frankencoin.sol";
import "./IERC677Receiver.sol";
import "./ERC20.sol";
import "./IReservePool.sol";

/** 
 * @title Reserve pool for the Frankencoin
 */
abstract contract ReservePool is ERC20 {

    uint256 private minterReserve; // scaled by 1000'000 to avoid loss of precision

    Frankencoin public immutable zchf;

    constructor(Frankencoin zchf_) ERC20(18){
        zchf = zchf_;
    }

    modifier frankencoinOnly(){
        require(msg.sender == address(zchf));
        _;
    }

    function notifyMinterReserveAdded(uint256 amount) external frankencoinOnly {
        minterReserve += amount;
    }

    function reduceReserve(address recipient, uint256 currentReserve, uint256 amount) external frankencoinOnly returns (uint256) {
        uint256 newMinterReserve = minterReserve - amount;
        if (currentReserve < minterReserve){
            amount = amount * currentReserve / minterReserve; // reduce proportionally
        }
        minterReserve = newMinterReserve;
        zchf.transfer(recipient, amount);
        return amount;
    }

}