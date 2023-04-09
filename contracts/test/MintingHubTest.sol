// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Strings.sol";
import "./TestToken.sol";
import "../IERC20.sol";
import "../Equity.sol";
import "../IReserve.sol";
import "../IFrankencoin.sol";
import "../Ownable.sol";
import "../Position.sol";
import "../IPosition.sol";
import "../MintingHub.sol";
import "../StablecoinBridge.sol";

contract MintingHubTest {

    MintingHub hub;
    StablecoinBridge swap;

    IERC20 xchf;
    TestToken col;
    IFrankencoin zchf;

    User alice;
    User bob;

    address latestPosition;
    uint256 latestChallenge;

    constructor(address hub_, address swap_){
        hub = MintingHub(hub_);
        swap = StablecoinBridge(swap_);
        col = new TestToken("Some Collateral", "COL", uint8(0));
        xchf = swap.chf();
        zchf = swap.zchf();
        alice = new User(zchf);
        bob = new User(zchf);
    }

    function initiateEquity() public {
        require(zchf.reserve().totalSupply() == 0, Strings.toString(zchf.reserve().totalSupply()));
        require(zchf.equity() == 1101000000000000000001, Strings.toString(zchf.equity()));
         // ensure there is at least 25'000 ZCHF in equity
        bob.obtainFrankencoins(swap, 10000 ether);
        bob.invest(1000 ether);
        require(zchf.reserve().totalSupply() == 1000 ether, Strings.toString(zchf.reserve().totalSupply()));
        bob.invest(9000 ether);
        alice.obtainFrankencoins(swap, 15000 ether);
        alice.invest(15000 ether);
        require(zchf.equity() > 25000 ether, Strings.toString(zchf.equity()));
    }

    function initiateAndDenyPosition() public {
        alice.obtainFrankencoins(swap, 1000 ether);
        address pos = alice.initiatePosition(col, hub);
        bob.deny(hub, pos);
    }

    function initiatePosition() public {
        alice.obtainFrankencoins(swap, 1000 ether);
        latestPosition = alice.initiatePosition(col, hub);
        require(col.balanceOf(address(alice)) == 0);
    }

    function testWithdraw() public {
        alice.testWithdraw(swap, Position(latestPosition));
    }

    function letAliceMint() public {
        alice.mint(latestPosition, 1); // test small amount to provoke rounding error
        alice.transferOwnership(latestPosition, address(bob));
        uint256 bobbalance = zchf.balanceOf(address(bob));
        bob.mint(latestPosition, 7);
        require(zchf.balanceOf(address(bob))> bobbalance);
        bob.transferOwnership(latestPosition, address(alice));
        alice.mint(latestPosition, 0);
        alice.mint(latestPosition, 100000 * (10 ** 18) - 8);
        alice.adjustPosition(latestPosition);
        require(Position(latestPosition).minted() == 100000 ether);
    }

    function letBobMint() public {
        bob.mint(latestPosition, 1);
    }

    function letBobChallenge() public returns (uint256) {
        col.mint(address(bob), 1300);

        // three challenges in parallel :)
        uint256 first = bob.challenge(hub, latestPosition, 300);
        require(hub.isChallengeOpen(first));
        uint256 second = bob.challenge(hub, latestPosition, 400);
        latestChallenge = bob.challenge(hub, latestPosition, 500);

        alice.avertChallenge(hub, swap, first);
        bob.obtainFrankencoins(swap, 30_000 ether);
        bob.bid(hub, second, 10_000 ether);
        bob.bid(hub, latestChallenge, 20_000 ether);
        (address challenger, IPosition p, uint256 size, uint256 a, address b, uint256 bid) = hub.challenges(latestChallenge);
        require(challenger != address(0x0), "challenge not found");
        require(bid == 20_000 ether);
        return latestChallenge;
    }

    function endChallenges() public {
        uint256 reservesBefore = zchf.balanceOf(address(zchf.reserve())) - zchf.equity();
        // revertWith("reserves before ", reservesBefore);  // 21000.000000000000000000
        endChallenge(latestChallenge); // can be absorbed with equity
        uint256 reservesAfter = zchf.balanceOf(address(zchf.reserve())) - zchf.equity();
        require(reservesBefore - reservesAfter == 10000 ether); // latest challenge was 50'000 with 20% reserve
        // revertWith("reserves before ", reservesAfter);  // 11000.000000000000000000
        // revertWith("reserves before ", zchf.equity());     //  8601.000000000000000003
        splitAndEnd(latestChallenge - 1);
    }

    function getChallenge(uint256 number) public view returns (uint256, uint256) {
         (address challenger1, IPosition p1, uint256 size1, uint256 a1, address b1, uint256 bid1) = hub.challenges(number);
         return (size1, bid1);
    }

    function splitAndEnd(uint256 number) public {
        (uint256 size1, uint256 bid1) = getChallenge(number);
        // revertWith("bid1 ", bid1); // 10000000000000000000000
        uint256 other = hub.splitChallenge(latestChallenge - 1, 101);
        (uint256 size2, uint256 bid2) = getChallenge(other);
        (uint256 size3, uint256 bid3) = getChallenge(number);
        // revertWith("bid2 ", bid2); // 2525000000000000000000
        require (size1 == size2 + size3);
        require (bid1 == bid2 + bid3);
        endChallenge(number); // devastating loss, equity wiped out
        // revertWith("minted ", Position(latestPosition).minted()); 20100000000000000000000
        alice.repay(Position(latestPosition), Position(latestPosition).minted() - 100);
        // revertWith("minted ", Position(latestPosition).minted()); 
        endChallenge(other);
        require(zchf.equity() == 0);
    }

    function endChallenge(uint256 number) public {
        uint256 equityBefore = zchf.equity();
        (address challenger, IPosition p, uint256 size, uint256 a, address b, uint256 bid) = hub.challenges(number);
        require(challenger != address(0x0), "challenge not found");
        hub.end(number, true);
        User user = challenger == address(bob) ? bob : alice;
        user.reclaimCollateral(hub, p.collateral(), size);

        uint256 borrowedAmount = 50000 * (10 ** 18);
        uint256 reserve = borrowedAmount * p.reserveContribution() / 1000000;
        uint256 reward = borrowedAmount * 20000 / 1000000;
        uint256 missing = borrowedAmount + reward - bid - reserve;
        uint256 equityAfter = zchf.equity();
        uint256 assigned = zchf.calculateAssignedReserve(1000000, uint32(200000));
        if (equityBefore >= missing){
            string memory message = string(abi.encodePacked(Strings.toString(equityBefore), " ",
               Strings.toString(equityAfter), " ", Strings.toString(missing)));
            require(equityAfter + missing == equityBefore, message);
        } else {
            // revertWith("reserve ", assigned); // 50601000000000000000003
            require(equityAfter == 0, Strings.toString(equityAfter)); // wiped out equity
            require(assigned == 0 || zchf.calculateAssignedReserve(1000000, 200000) < assigned);
            // theoretical minter reserve at this point: 3000.000000000000000000, actual: 0
        }
    }

    function testExcessiveChallenge() public {
        // revertWith("reserve ", zchf.balanceOf(address(zchf.reserve()))); // 50601000000000000000003
        Position pos = Position(latestPosition);
        //uint256 minted = pos.minted();
//        require(minted == 10000 ether, Strings.toString(minted)); // assumes the other tests have been run before
        uint256 collateralLeft = pos.collateral().balanceOf(latestPosition);
        require(collateralLeft == 100, Strings.toString(collateralLeft)); // test assumption
        uint256 number = bob.challenge(hub, latestPosition, 101); // challenge more than is left
     //   alice.repay(pos, 5000 ether);
       // require(pos.minted() + 5000 ether == minted);
        // minted is now 9999.999999999999995000
        bob.avertChallenge(hub, swap, number);
    }

    function restructure() public {
        address[] memory empty = new address[](0);
        zchf.reserve().checkQualified(address(alice), empty);
        zchf.reserve().checkQualified(address(bob), empty);
        address[] memory list = new address[](1);
        list[0] = address(bob);
        Equity equity = Equity(address(zchf.reserve()));
        uint256 totalVotes = equity.totalVotes();
        uint256 supplyBefore = equity.totalSupply();
        uint256 bobBefore = equity.balanceOf(address(bob));
        alice.restructure(empty, list);
        zchf.reserve().checkQualified(address(alice), empty);
        require(equity.totalVotes() < totalVotes);
        require(equity.balanceOf(address(bob)) == 0);
        uint256 supplyAfter = equity.totalSupply();
        require(supplyAfter == supplyBefore - bobBefore);
        // revertWith("Shortfall: ", zchf.minterReserve() - zchf.balanceOf(address(zchf.reserve()))); // 1000000000000000000000
        alice.obtainFrankencoins(swap, 2000 ether);
        alice.invest(2000 ether);
        require(supplyAfter + 1000 ether == equity.totalSupply());
    }

    // poor man's replacement for console.out in solidity...
    function revertWith(string memory msg, uint256 number) pure public {
        revert(string(abi.encodePacked(msg, Strings.toString(number))));
    }

    function challengeExpiredPosition() public {
        Position pos = Position(latestPosition);
        require(pos.calculateCurrentFee() == 0);
        require(pos.expiration() < block.timestamp);
        uint256 size = pos.collateral().balanceOf(latestPosition);
        latestChallenge = bob.challenge(hub, latestPosition, size);
        // revertWith("col left ", size); // 100
        bob.obtainFrankencoins(swap, 5000 ether);
    }

    function bidNearEndOfChallenge() public {
        (address challenger, IPosition p, uint256 size, uint256 end, address b, uint256 bid) = hub.challenges(latestChallenge);
        require(block.timestamp < end);
        require(end < block.timestamp + 30 minutes);
        bob.bid(hub, latestChallenge, 5000 ether);
        (address challenger2, IPosition p2, uint256 size2, uint256 end2, address b2, uint256 bid2) = hub.challenges(latestChallenge);
        require(end2 > end); // time should be increased near end of auction
    }

    function endLastChallenge() public {
        Position pos = Position(latestPosition);
        hub.end(latestChallenge);
        require(pos.collateral().balanceOf(latestPosition) == 0);
    }

}

contract User {

    IFrankencoin zchf;

    constructor(IFrankencoin zchf_){
        zchf = zchf_;
    }

    function obtainFrankencoins(StablecoinBridge bridge, uint256 amount) public {
        TestToken xchf = TestToken(address(bridge.chf()));
        xchf.mint(address(this), amount);
        xchf.approve(address(bridge), amount);
        require(xchf.allowance(address(this), address(bridge)) == amount);
        bridge.mint(amount);
    }

    function invest(uint256 amount) public {
        zchf.transferAndCall(address(zchf.reserve()), amount, "");
    }

    function transfer(IERC20 token, address target, uint256 amount) public {
        token.transfer(target, amount);
    }

    function initiatePosition(TestToken col, MintingHub hub) public returns (address) {
        col.mint(address(this), 1001);
        col.approve(address(hub), 1001);
        uint256 balanceBefore = zchf.balanceOf(address(this));
        address pos = hub.openPosition(address(col), 100, 1001, 1000000 ether, 100 days, 1 days, 25000, 100 * (10 ** 36), 200000);
        require((balanceBefore - hub.OPENING_FEE()) == zchf.balanceOf(address(this)));
        Position(pos).adjust(0, 1001, 200 * (10 ** 36));
        Position(pos).adjustPrice(100 * (10 ** 36));
        return pos;
    }

    function transferOwnership(address pos, address newOwner) public {
        Position(pos).transferOwnership(newOwner);
    }

    function deny(MintingHub hub, address pos) public {
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
        uint256 balanceBefore = zchf.balanceOf(address(this));
        require(balanceBefore >= amount);
        pos.repay(amount);
        require(zchf.balanceOf(address(this)) + amount == balanceBefore);
    }

    function testWithdraw(StablecoinBridge bridge, Position pos) public {
        IERC20 col = pos.collateral();
        obtainFrankencoins(bridge, 1);
        bridge.zchf().transfer(address(pos), 1);
        uint256 initialBalance = col.balanceOf(address(pos));
        pos.withdraw(address(bridge.zchf()), address(this), 1);
        Position(pos).withdraw(address(col), address(this), 1);
        require(col.balanceOf(address(pos)) == initialBalance - 1);
        require(col.balanceOf(address(this)) == 1);
    }

    function mint(address pos, uint256 amount) public {
        uint256 balanceBefore = zchf.balanceOf(address(this));
        IPosition(pos).mint(address(this), amount);
        uint256 obtained = zchf.balanceOf(address(this)) - balanceBefore;
        uint256 usable = IPosition(pos).getUsableMint(amount, true);
        require(obtained == usable, string(abi.encodePacked(Strings.toString(usable), " should be ", Strings.toString(obtained))));
        uint256 usableBeforeFee = IPosition(pos).getUsableMint(amount, false);
        require(usable <= 100 || usableBeforeFee > usable, string(abi.encodePacked(Strings.toString(usableBeforeFee), " should be larger than ", Strings.toString(usable))));
    }

    function challenge(MintingHub hub, address pos, uint256 size) public returns (uint256) {
        IERC20 col = IPosition(pos).collateral();
        col.approve(address(hub), size);
        return hub.launchChallenge(pos, size);
    }

    function avertChallenge(MintingHub hub, StablecoinBridge swap, uint256 first) public {
        {
            (address challenger, IPosition p, uint256 size, uint256 a, address b, uint256 bid) = hub.challenges(first);
            uint256 amount = size * p.price() / 10 ** 18;
            obtainFrankencoins(swap, amount);
            hub.bid(first, amount, size); // avert challenge
        }
        (address challenger, IPosition p, uint256 size, uint256 a, address b, uint256 bid) = hub.challenges(first);
        require(challenger == address(0x0), "challenge not averted");
        require(!hub.isChallengeOpen(first));
    }

    function bid(MintingHub hub, uint256 number, uint256 amount) public {
        (address challenger, IPosition p, uint256 size, uint256 a, address b, uint256 bid) = hub.challenges(number);
        hub.bid(number, amount, size);
        require(hub.minBid(number) > amount); // min bid must increase
    }

    function reclaimCollateral(MintingHub hub, IERC20 collateral, uint256 expectedAmount) public {
        uint256 balanceBefore = collateral.balanceOf(address(this));
        hub.returnPostponedCollateral(address(collateral), address(this));
        uint256 balanceAfter = collateral.balanceOf(address(this));
        require(balanceBefore + expectedAmount == balanceAfter);
    }

    function restructure(address[] calldata helpers, address[] calldata addressesToWipe) public {
        Equity(address(zchf.reserve())).restructureCapTable(helpers, addressesToWipe);
    }

}