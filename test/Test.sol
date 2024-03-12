// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import "node_modules/forge-std/Test.sol";

import "../contracts/test/Strings.sol";
import "../contracts/test/TestToken.sol";
import "../contracts/Equity.sol";
import "../contracts/StablecoinBridge.sol";
import "../contracts/Equity.sol";
import "../contracts/Frankencoin.sol";
import "../contracts/utils/FPSwrapper.sol";

contract MintingHubTest {
    
    Frankencoin zchf;
    Equity fps;
    StablecoinBridge swap;
    TestToken xchf;
    FPSWrapper wfps;

    constructor() {
        zchf = new Frankencoin(0);
        fps = Equity(address(zchf.reserve()));
        wfps = new FPSWrapper(fps);
        xchf = new TestToken("Base Franc", "BCHF", uint8(18));
        swap = new StablecoinBridge(address(xchf), address(zchf), 100000 ether);
        zchf.initialize(address(swap), "");
        xchf.mint(address(this), 100000 ether);
        xchf.approve(address(swap), 100000 ether);
        swap.mint(100000 ether);
        fps.invest(100000 ether, 0);
    }

    function testWrapper() public view returns (uint256) {
        return fps.balanceOf(address(this));
    }
}