// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Strings.sol";
import "./TestToken.sol";
import "../Equity.sol";
import "../utils/Ownable.sol";
import "../Position.sol";
import "../MintingHub.sol";
import "../StablecoinBridge.sol";
import "../interface/IPosition.sol";
import "../interface/IReserve.sol";
import "../interface/IFrankencoin.sol";
import "../interface/IERC20.sol";

contract PositionRollingTest {

    MintingHub hub;
    TestToken col;
    IFrankencoin zchf;
    PositionRoller roller;

    IPosition public p1;
    IPosition public p2;

    constructor(address hub_) {
        hub = MintingHub(hub_);
        col = new TestToken("Some Collateral", "COL", uint8(0));
        zchf = hub.zchf();
        roller = hub.roller();
    }

    function openTwoPositions() public {
        p1 = IPosition(openPosition(100, uint40(3 days)));
        p2 = IPosition(openPosition(10, uint40(7 days)));
    }

    function mintFromFirstPosition(uint256 amount) public {
        p1.mint(address(this), amount);
    }

    function openPosition(uint256 collateral, uint40 initializationDelay) public returns (address) {
        col.mint(address(this), collateral);
        col.approve(address(hub), collateral);
        return hub.openPosition(address(col), 10, collateral, 1000000 * 10**18, initializationDelay, 30 days, 10 hours, 50000, 1000 * 10**36, 200000);
    }

    function roll() public {
        roller.rollFully(p1, p2);
        require(p1.minted() == 0);
        require(zchf.balanceOf(address(this)) == 0);
    }

}
