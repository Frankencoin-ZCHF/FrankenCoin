// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// import "./Strings.sol";
import "./TestToken.sol";
import "../Equity.sol";
import "../MintingHubV2/Position.sol";
import "../MintingHubV2/MintingHub.sol";
import "../StablecoinBridge.sol";
import "../MintingHubV2/interface/IPosition.sol";
import "../interface/IReserve.sol";
import "../interface/IDecentralizedEURO.sol";

contract PositionExpirationTest {
    MintingHub hub;
    TestToken col;
    IDecentralizedEURO deuro;

    constructor(address hub_) {
        hub = MintingHub(hub_);
        col = new TestToken("Some Collateral", "COL", uint8(0));
        deuro = hub.deur();
    }

    function openPositionFor(address owner) public returns (address) {
        col.mint(address(this), 100);
        col.approve(address(hub), 100);
        address pos = hub.openPosition(
            address(col),
            10,
            100 /* collateral */,
            1000000 * 10 ** 18,
            7 days,
            30 days,
            10 hours,
            50000,
            1000 * 10 ** 36 /* price */,
            200000
        );
        Position(pos).transferOwnership(owner);
        return pos;
    }

    function forceBuy(address pos, uint256 amount) public {
        uint256 price = hub.expiredPurchasePrice(Position(pos));
        uint256 balanceBefore = deuro.balanceOf(address(this));
        uint256 colBalBefore = col.balanceOf(address(this));
        hub.buyExpiredCollateral(Position(pos), amount);
        uint256 balanceAfter = deuro.balanceOf(address(this));
        uint256 colBalAfter = col.balanceOf(address(this));
        require(colBalAfter - colBalBefore == amount, "collateral amount");
        require((balanceBefore - balanceAfter) == (amount * price) / 10 ** 18, "price paid");
    }
}
