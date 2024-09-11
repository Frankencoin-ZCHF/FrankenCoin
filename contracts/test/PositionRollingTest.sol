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

    constructor(address hub_) {
        hub = MintingHub(hub_);
        col = new TestToken("Some Collateral", "COL", uint8(0));
        zchf = hub.zchf();
        roller = hub.roller();
    }

    function openPosition(uint256 collateral) public returns (address) {
        col.mint(address(this), collateral);
        col.approve(address(hub), collateral);
        return hub.openPosition(address(col), 10, collateral, 1000000 * 10**18, 7 days, 30 days, 10 hours, 50000, 1000 * 10**36, 200000);
    }

    function mint(address position, address target, uint256 amount) public {
        IPosition(position).mint(target, amount);
    }

    function roll(address p1, address p2, uint256 borrowAmount, uint256 repayAmount) public {
        //roller.roll(IPosition(p1), IPosition(p2), 200)
    }

}
