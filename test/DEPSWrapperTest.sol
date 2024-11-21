// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";

import "../contracts/test/TestToken.sol";
import "../contracts/Equity.sol";
import "../contracts/StablecoinBridge.sol";
import "../contracts/Equity.sol";
import "../contracts/EuroCoin.sol";
import "../contracts/utils/DEPSwrapper.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract nDEPSWrapperTest is Test {
    
    EuroCoin dEURO;
    Equity nDEPS;
    StablecoinBridge swap;
    TestToken XEUR;
    nDEPSWrapper wnDEPS;

    error General(uint256 val);

    constructor() {
        dEURO = new EuroCoin(0);
        nDEPS = Equity(address(dEURO.reserve()));
        wnDEPS = new nDEPSWrapper(nDEPS);
        XEUR = new TestToken("Base Franc", "BEUR", uint8(18));
        swap = new StablecoinBridge(address(XEUR), address(dEURO), 100000 ether);
        dEURO.initialize(address(swap), "");
        XEUR.mint(address(this), 100000 ether);
        XEUR.approve(address(swap), 100000 ether);
        swap.mint(100000 ether);
        nDEPS.invest(100000 ether, 0);
    }

    function testWrapper() public {
        nDEPS.approve(address(wnDEPS), 500 ether);
        wnDEPS.wrap(500 ether);
        vm.expectRevert();
        wnDEPS.wrap(1);
        require(wnDEPS.balanceOf(address(this)) == 500 ether);
        vm.warp(block.timestamp + 5);
        uint256 votesBefore = nDEPS.votes(address(wnDEPS));
        uint256 tot = nDEPS.totalVotes();
        wnDEPS.halveHoldingDuration(new address[](0));
        uint256 votesAfter = nDEPS.votes(address(wnDEPS));
        console.log("wnDEPS votes ", nDEPS.votes(address(wnDEPS)));
        console.log("total votes ", nDEPS.totalVotes());
        require(votesAfter == votesBefore / 2);
        require(nDEPS.totalVotes() == tot + votesAfter - votesBefore);
        vm.expectRevert();
        wnDEPS.unwrapAndSell(10 ether);
        wnDEPS.unwrap(10 ether);
        require(nDEPS.balanceOf(address(this)) == 510 ether);
        vm.warp(block.timestamp + 90*24*3600);
        wnDEPS.unwrapAndSell(10 ether);
        require(nDEPS.totalSupply() == 990 ether);
        nDEPS.redeem(address(this), 510 ether);
        vm.expectRevert();
        wnDEPS.halveHoldingDuration(new address[](0));
    }

    function testDepositAndWithdraw() public {
        nDEPS.approve(address(wnDEPS), 10 ether);
        wnDEPS.depositFor(address(0x1), 1 ether);
        require(wnDEPS.balanceOf(address(0x1)) == 1 ether);
        vm.expectRevert();
        wnDEPS.withdrawTo(address(0x1), 1 ether);
        wnDEPS.wrap(1 ether);
        wnDEPS.withdrawTo(address(0x2), 1 ether);
        require(wnDEPS.underlying().balanceOf(address(0x2)) == 1 ether);
    }
}
