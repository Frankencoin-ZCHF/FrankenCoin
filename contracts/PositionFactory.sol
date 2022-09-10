// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./CloneFactory.sol";
import "./Position.sol";

contract PositionFactory is CloneFactory {

    function createNewPosition(address owner, address _zchf, address _collateral, uint256 minCollateral, uint256 initialCollateral, 
        uint256 initialLimit, uint256 duration, uint32 _mintingFeePPM, uint32 _reserve) external returns (address) {
        return address(new Position(owner, msg.sender, _zchf, _collateral, minCollateral, initialCollateral, initialLimit, duration, _mintingFeePPM, _reserve));
    }

    function clonePosition(address existing_, address owner, uint256 initialCol, uint256 initialMint) external returns (address) {
        Position existing = Position(existing_);
        uint256 limit = existing.reduceLimitForClone(initialMint);
        Position clone = Position(createClone(existing_));
        clone.initializeClone(owner, existing.price(), limit, initialCol, initialMint);
        return address(clone);
    }

}