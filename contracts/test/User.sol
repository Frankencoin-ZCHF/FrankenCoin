// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import {TestToken} from "./TestToken.sol";
import {Equity} from "../Equity.sol";
import {Position} from "../Position.sol";
import {MintingHub} from "../MintingHub.sol";
import {StablecoinBridge} from "../StablecoinBridge.sol";
import {IPosition} from "../interface/IPosition.sol";
import {IEuroCoin} from "../interface/IEuroCoin.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract User {
    IEuroCoin dEURO;

    constructor(IEuroCoin dEURO_) {
        dEURO = dEURO_;
    }

    function obtainEuroCoins(StablecoinBridge bridge, uint256 amount) public {
        TestToken xeur = TestToken(address(bridge.eur()));
        xeur.mint(address(this), amount);
        xeur.approve(address(bridge), amount);
        require(xeur.allowance(address(this), address(bridge)) == amount);
        bridge.mint(amount);
    }

    function invest(uint256 amount) public {
        dEURO.reserve().invest(amount, 0);
    }

    function transfer(IERC20 token, address target, uint256 amount) public {
        token.transfer(target, amount);
    }

    function initiatePosition(TestToken col, MintingHub hub) public returns (address) {
        col.mint(address(this), 1001);
        col.approve(address(hub), 1001);
        uint256 balanceBefore = dEURO.balanceOf(address(this));
        address pos = hub.openPositionOneWeek(
            address(col),
            100,
            1001,
            1000000 ether,
            100 days,
            1 days,
            25000,
            100 * (10 ** 36),
            200000
        );
        require((balanceBefore - hub.OPENING_FEE()) == dEURO.balanceOf(address(this)));
        Position(pos).adjust(0, 1001, 200 * (10 ** 36));
        Position(pos).adjustPrice(100 * (10 ** 36));
        return pos;
    }

    function transferOwnership(address pos, address newOwner) public {
        Position(pos).transferOwnership(newOwner);
    }

    function deny(MintingHub, address pos) public {
        address[] memory empty = new address[](0);
        Position(pos).deny(empty, "not approved");
    }

    function adjustPosition(address pos) public {
        Position position = Position(pos);
        uint256 minted = position.minted();
        uint256 col = position.collateral().balanceOf(pos);
        uint256 price = position.price();
        position.adjust(minted - 100, col - 1, price);
        position.collateral().approve(pos, 1);
        position.adjust(minted, col, price);
        require(position.minted() == minted);
        require(position.collateral().balanceOf(pos) == col);
        require(position.price() == price);
    }

    function repay(Position pos, uint256 amount) public {
        uint256 balanceBefore = dEURO.balanceOf(address(this));
        require(balanceBefore >= amount);
        pos.repay(amount);
        require(dEURO.balanceOf(address(this)) + amount == balanceBefore);
    }

    function testWithdraw(StablecoinBridge bridge, Position pos) public {
        IERC20 col = pos.collateral();
        obtainEuroCoins(bridge, 1);
        bridge.dEURO().transfer(address(pos), 1);
        uint256 initialBalance = col.balanceOf(address(pos));
        pos.withdraw(address(bridge.dEURO()), address(this), 1);
        Position(pos).withdraw(address(col), address(this), 1);
        require(col.balanceOf(address(pos)) == initialBalance - 1);
        require(col.balanceOf(address(this)) == 1);
    }

    function mint(address pos, uint256 amount) public {
        uint256 balanceBefore = dEURO.balanceOf(address(this));
        IPosition(pos).mint(address(this), amount);
        uint256 obtained = dEURO.balanceOf(address(this)) - balanceBefore;
        uint256 usable = IPosition(pos).getUsableMint(amount, true);
        require(
            obtained == usable,
            string(abi.encodePacked(Strings.toString(usable), " should be ", Strings.toString(obtained)))
        );
        uint256 usableBeforeFee = IPosition(pos).getUsableMint(amount, false);
        require(
            usable <= 100 || usableBeforeFee > usable,
            string(
                abi.encodePacked(Strings.toString(usableBeforeFee), " should be larger than ", Strings.toString(usable))
            )
        );
    }

    function challenge(MintingHub hub, address pos, uint256 size) public returns (uint256) {
        IERC20 col = IPosition(pos).collateral();
        col.approve(address(hub), size);
        return hub.challenge(pos, size, IPosition(pos).price());
    }

    function avertChallenge(MintingHub hub, StablecoinBridge swap, uint256 first) public {
        /* {
            (, IPosition p, uint256 size, , , ) = hub.challenges(first);
            uint256 amount = (size * p.price()) / 10 ** 18;
            obtainEuroCoins(swap, amount);
            hub.bid(first, amount, size); // avert challenge
        }
        (address challenger, , , , , ) = hub.challenges(first);
        require(challenger == address(0x0), "challenge not averted");
        require(!hub.isChallengeOpen(first)); */
    }

    function bid(MintingHub hub, uint256 number, uint256 amount) public {
        /*   (, , uint256 size, , , ) = hub.challenges(number);
        hub.bid(number, amount, size);
        require(hub.minBid(number) > amount); // min bid must increase */
    }

    function reclaimCollateral(MintingHub hub, IERC20 collateral, uint256 expectedAmount) public {
        uint256 balanceBefore = collateral.balanceOf(address(this));
        hub.returnPostponedCollateral(address(collateral), address(this));
        uint256 balanceAfter = collateral.balanceOf(address(this));
        require(balanceBefore + expectedAmount == balanceAfter);
    }

    function restructure(address[] calldata helpers, address[] calldata addressesToWipe) public {
        Equity(address(dEURO.reserve())).restructureCapTable(helpers, addressesToWipe);
    }
}
