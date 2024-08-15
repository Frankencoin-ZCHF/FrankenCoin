// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../Frankencoin.sol";
import "../PositionFactory.sol";
import "../MintingHub.sol";
import "../interface/IReserve.sol";

contract DeployerFrankencoin {
    Frankencoin public zchf;
    PositionFactory public factory;
    MintingHub public mintingHub;
    
    constructor() {
        zchf = new Frankencoin(1);
        factory = new PositionFactory();
        mintingHub = new MintingHub(address(zchf), address(factory));

        zchf.initialize(msg.sender, "Developer");
        zchf.initialize(address(this), "Deployer");
        zchf.initialize(address(mintingHub), "MintingHub");
    }

    function init() public {
        zchf.mint(msg.sender, 1_000_000 ether);
        zchf.mint(address(this), 1_000_000 ether);
        IReserve(zchf.reserve()).invest(1000 ether, 1000 ether);
        IReserve(zchf.reserve()).invest(100000 ether, 1 ether);
    }
}