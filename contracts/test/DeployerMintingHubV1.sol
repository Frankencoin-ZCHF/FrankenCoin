// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// native modules
import "../Frankencoin.sol";
import "../interface/IReserve.sol";
import "../utils/FPSWrapper.sol";

// MintingHubV1
import "../MintingHubV1/PositionFactory.sol";
import "../MintingHubV1/MintingHub.sol";

contract DeployerMintingHubV1 {
    string public constant NAME = "DeployerMintingHubV1";
    Frankencoin public zchf;
    PositionFactory public factory;
    MintingHub public mintingHub;
    FPSWrapper public fpsWrapper;

    event Log(address sender, string message);

    constructor() {
        zchf = new Frankencoin(1);
        factory = new PositionFactory();
        mintingHub = new MintingHub(address(zchf), address(factory));
        fpsWrapper = new FPSWrapper(Equity(address(zchf.reserve())));

        zchf.initialize(msg.sender, "Developer");
        zchf.initialize(address(this), "Deployer");
        zchf.initialize(address(mintingHub), "MintingHub");
    }

    function initFrankencoin() public {
        uint256 toMint = 1_000_000 ether;
        zchf.mint(address(this), 2 * toMint);
        IReserve(zchf.reserve()).invest(toMint, 1000 ether);
        zchf.mint(msg.sender, toMint);
    }
}
