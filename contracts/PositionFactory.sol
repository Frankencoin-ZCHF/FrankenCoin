// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./CloneFactory.sol";
import "./Position.sol";
import "./IPosition.sol";

contract PositionFactory is CloneFactory, IPositionFactory {

    function createNewPosition(address owner, address _zchf, address _collateral, uint256 initialCollateral, 
        uint256 initialLimit, uint256 duration, uint32 _mintingFeePPM, uint32 _reserve) external returns (address) {
        return address(new Position(msg.sender, owner, _zchf, _collateral, initialCollateral, initialLimit, duration, _mintingFeePPM, _reserve));
    }

    function clonePosition(address existing_, address owner, uint256 initialCol, uint256 initialMint) external returns (address) {
        Position existing = Position(existing_);
        uint256 limit = existing.reduceLimitForClone(initialMint);
        Position clone = createClone(existing);
        clone.initializeClone(owner, existing.price(), limit, initialMint);
    }

}