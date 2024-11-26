// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {TestToken} from "./TestToken.sol";
import {Equity} from "../Equity.sol";
import {Position} from "../Position.sol";
import {MintingHub} from "../MintingHub.sol";
import {StablecoinBridge} from "../StablecoinBridge.sol";
import {IPosition} from "../interface/IPosition.sol";
import {IEuroCoin} from "../interface/IEuroCoin.sol";
import {User} from "./User.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract MintingHubTest {
    MintingHub hub;
    StablecoinBridge swap;

    IERC20 xeur;
    TestToken col;
    IEuroCoin dEURO;

    User alice;
    User bob;

    address latestPosition;
    uint256 latestChallenge;

    constructor(address hub_, address swap_) {
        hub = MintingHub(hub_);
        swap = StablecoinBridge(swap_);
        col = new TestToken("Some Collateral", "COL", uint8(0));
        xeur = swap.eur();
        dEURO = swap.dEURO();
        alice = new User(dEURO);
        bob = new User(dEURO);
        require(dEURO.reserve().totalSupply() == 0, Strings.toString(dEURO.reserve().totalSupply()));
    }

    function initiateEquity() public {
        require(dEURO.equity() == 1003849100000000000001, Strings.toString(dEURO.equity()));
        require(dEURO.reserve().totalSupply() == 0, Strings.toString(dEURO.reserve().totalSupply()));
        // ensure there is at least 25'000 dEURO in equity
        bob.obtainEuroCoins(swap, 10000 ether);
        bob.invest(1000 ether);
        require(dEURO.reserve().totalSupply() == 1000 ether, Strings.toString(dEURO.reserve().totalSupply()));
        bob.invest(9000 ether);
        alice.obtainEuroCoins(swap, 15000 ether);
        alice.invest(15000 ether);
        require(dEURO.equity() > 25000 ether, Strings.toString(dEURO.equity()));
    }

    function initiateAndDenyPosition() public {
        alice.obtainEuroCoins(swap, 1000 ether);
        address pos = alice.initiatePosition(col, hub);
        bob.deny(hub, pos);
    }

    function initiatePosition() public {
        alice.obtainEuroCoins(swap, 1000 ether);
        latestPosition = alice.initiatePosition(col, hub);
        require(col.balanceOf(address(alice)) == 0);
    }

    function testWithdraw() public {
        alice.testWithdraw(swap, Position(latestPosition));
    }

    function letAliceMint() public {
        alice.mint(latestPosition, 1); // test small amount to provoke rounding error
        alice.transferOwnership(latestPosition, address(bob));
        uint256 bobbalance = dEURO.balanceOf(address(bob));
        bob.mint(latestPosition, 7);
        require(dEURO.balanceOf(address(bob)) > bobbalance);
        bob.transferOwnership(latestPosition, address(alice));
        alice.mint(latestPosition, 0);
        alice.mint(latestPosition, 100000 * (10 ** 18) - 8);
        alice.adjustPosition(latestPosition);
        require(Position(latestPosition).minted() == 100000 ether);
    }

    function letBobMint() public {
        bob.mint(latestPosition, 1);
    }

    uint256 first;
    uint256 second;

    function letBobChallengePart1() public {
        col.mint(address(bob), 1300);

        // three challenges in parallel :)
        first = bob.challenge(hub, latestPosition, 300);
        second = bob.challenge(hub, latestPosition, 400);
        latestChallenge = bob.challenge(hub, latestPosition, 500);
    }

    function letBobChallengePart2() public returns (uint256) {
        /* alice.avertChallenge(hub, swap, first);
        bob.obtainEuroCoins(swap, 30_000 ether);
        bob.bid(hub, second, 10_000 ether);
        bob.bid(hub, latestChallenge, 20_000 ether);
        (address challenger, , , , , uint256 bid) = hub.challenges(
            latestChallenge
        );
        require(challenger != address(0x0), "challenge not found");
        require(bid == 20_000 ether);
        return latestChallenge; */
    }

    function endChallenges() public {
        uint256 reservesBefore = dEURO.balanceOf(address(dEURO.reserve())) - dEURO.equity();
        // revertWith("reserves before ", reservesBefore);  // 21000.000000000000000000
        endChallenge(latestChallenge); // can be absorbed with equity
        uint256 reservesAfter = dEURO.balanceOf(address(dEURO.reserve())) - dEURO.equity();
        require(reservesBefore - reservesAfter == 10000 ether); // latest challenge was 50'000 with 20% reserve
        // revertWith("reserves before ", reservesAfter);  // 11000.000000000000000000
        // revertWith("reserves before ", dEURO.equity());     //  8601.000000000000000003
        // splitAndEnd(latestChallenge - 1);
    }

    function endChallenge(uint256 challengeNumber) public {
        uint256 equityBefore = dEURO.equity();
        (address challenger, uint64 start, IPosition p, uint256 size) = hub.challenges(challengeNumber);
        require(challenger != address(0x0), "challenge not found");
        // hub.end(challengeNumber, true);
        User user = challenger == address(bob) ? bob : alice;
        user.reclaimCollateral(hub, p.collateral(), size);

        /*         
        uint256 borrowedAmount = 50000 * (10 ** 18);
        uint256 reserve = (borrowedAmount * p.reserveContribution()) / 1000000;
        uint256 reward = (bid * 20000) / 1000000;
        uint256 missing = borrowedAmount + reward - bid - reserve;
        uint256 equityAfter = dEURO.equity();
        uint256 assigned = dEURO.calculateAssignedReserve(
            1000000,
            uint32(200000)
        );
        if (equityBefore >= missing) {
            string memory message = string(
                abi.encodePacked(
                    Strings.toString(equityBefore),
                    " ",
                    Strings.toString(equityAfter),
                    " ",
                    Strings.toString(missing)
                )
            );
            require(equityAfter + missing == equityBefore, message);
        } else {
            // revertWith("reserve ", assigned); // 50601000000000000000003
            require(equityAfter == 0, Strings.toString(equityAfter)); // wiped out equity
            require(
                assigned == 0 ||
                    dEURO.calculateAssignedReserve(1000000, 200000) < assigned
            );
            // theoretical minter reserve at this point: 3000.000000000000000000, actual: 0
        } 
        */
    }

    uint256 number;

    function testExcessiveChallengePart1() public {
        // revertWith("reserve ", dEURO.balanceOf(address(dEURO.reserve()))); // 50601000000000000000003
        Position pos = Position(latestPosition);
        //uint256 minted = pos.minted();
        //        require(minted == 10000 ether, Strings.toString(minted)); // assumes the other tests have been run before
        uint256 collateralLeft = pos.collateral().balanceOf(latestPosition);
        require(collateralLeft == 100, Strings.toString(collateralLeft)); // test assumption
        number = bob.challenge(hub, latestPosition, 101); // challenge more than is left
        //   alice.repay(pos, 5000 ether);
        // require(pos.minted() + 5000 ether == minted);
        // minted is now 9999.999999999999995000
    }

    function testExcessiveChallengePart2() public {
        bob.avertChallenge(hub, swap, number);
    }

    function restructure() public {
        address[] memory empty = new address[](0);
        dEURO.reserve().checkQualified(address(alice), empty);
        dEURO.reserve().checkQualified(address(bob), empty);
        address[] memory list = new address[](1);
        list[0] = address(bob);
        Equity equity = Equity(address(dEURO.reserve()));
        uint256 totalVotes = equity.totalVotes();
        uint256 supplyBefore = equity.totalSupply();
        uint256 bobBefore = equity.balanceOf(address(bob));
        alice.restructure(empty, list);
        dEURO.reserve().checkQualified(address(alice), empty);
        require(equity.totalVotes() < totalVotes);
        require(equity.balanceOf(address(bob)) == 0);
        uint256 supplyAfter = equity.totalSupply();
        require(supplyAfter == supplyBefore - bobBefore);
        // revertWith("Shortfall: ", dEURO.minterReserve() - dEURO.balanceOf(address(dEURO.reserve()))); // 1000000000000000000000
        alice.obtainEuroCoins(swap, 4000 ether);
        alice.invest(4000 ether);
        require(supplyAfter + 1000 ether == equity.totalSupply());
    }

    // poor man's replacement for console.out in solidity...
    function revertWith(string memory message, uint256 errorNumber) public pure {
        revert(string(abi.encodePacked(message, Strings.toString(errorNumber))));
    }

    function challengeExpiredPosition() public {
        Position pos = Position(latestPosition);
        require(pos.calculateCurrentFee() == 0);
        require(pos.expiration() < block.timestamp);
        uint256 size = pos.collateral().balanceOf(latestPosition);
        latestChallenge = bob.challenge(hub, latestPosition, size);
        // revertWith("col left ", size); // 100
        bob.obtainEuroCoins(swap, 5000 ether);
    }

    function endLastChallenge() public view {
        Position pos = Position(latestPosition);
        // hub.end(latestChallenge, false);
        require(pos.collateral().balanceOf(latestPosition) == 0);
    }
}
