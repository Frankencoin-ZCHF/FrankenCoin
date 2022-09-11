// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./CloneFactory.sol";
import "./Position.sol";

contract PositionFactory is CloneFactory {

    function createNewPosition(address _owner, address _zchf, address _collateral, 
        uint256 _minCollateral, uint256 _initialCollateral, 
        uint256 _initialLimit, uint256 _duration, uint32 _mintingFeePPM, uint32 _reserve) 
        external returns (address) 
    {
        return address(new Position(_owner, msg.sender, _zchf, _collateral, 
            _minCollateral, _initialCollateral, _initialLimit, _duration, _mintingFeePPM, _reserve));
    }

    function clonePosition(address existing_, address owner, uint256 initialCol, uint256 initialMint) external returns (address) {
        Position existing = Position(existing_);
        uint256 limit = existing.reduceLimitForClone(initialMint);
        Position clone = Position(createClone(existing.original()));
        clone.initializeClone(owner, existing.price(), limit, initialCol, initialMint);
        return address(clone);
    }

}