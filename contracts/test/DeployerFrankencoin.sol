// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../Frankencoin.sol";
import "../MintingHubV2/PositionFactory.sol";
import "../MintingHubV2/MintingHub.sol";
import "../Leadrate.sol";
import "../interface/IReserve.sol";

contract DeployerFrankencoin {
    string public constant NAME = "DeployerV0";
    Frankencoin public zchf;
    PositionFactory public factory;
    Leadrate public leadrate;
    PositionRoller public roller;
    MintingHub public mintingHub;

    event Log(address sender, string message);

    constructor() {
        zchf = new Frankencoin(1);
        factory = new PositionFactory();
        roller = new PositionRoller(address(zchf));
        leadrate = new Leadrate(zchf.reserve(), 20000);
        mintingHub = new MintingHub(address(zchf), address(leadrate), address(roller), address(factory));

        zchf.initialize(msg.sender, "Developer");
        zchf.initialize(address(this), "Deployer");
        zchf.initialize(address(mintingHub), "MintingHub");
        zchf.initialize(address(roller), "Roller");
    }

    function initA_Frankencoin() public {
        uint256 toMint = 1_000_000 ether;
        zchf.mint(address(this), 2 * toMint);
        IReserve(zchf.reserve()).invest(toMint, 1000 ether);

        // for sender
        zchf.mint(msg.sender, toMint);
    }

    function increaseLeadrate() public {
        leadrate.proposeChange(leadrate.currentRatePPM() + 1000, new address[](0));
    }

    function revertLeadrate() public {
        leadrate.proposeChange(leadrate.currentRatePPM(), new address[](0));
    }
}
