// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// native modules
import "../Frankencoin.sol";
import "../interface/IReserve.sol";
import "../Savings.sol";
import "../PositionRoller.sol";

// MintingHubV2
import "../MintingHubV2/PositionFactory.sol";
import "../MintingHubV2/MintingHub.sol";

contract DeployerMintingHubV2 {
    string public constant NAME = "DeployerMintingHubV2";
    Frankencoin public zchf;
    Savings public savings;
    PositionRoller public roller;

    PositionFactory public factory;
    MintingHub public mintingHub;

    event Log(address sender, string message);

    constructor(address _zchf) {
        zchf = Frankencoin(_zchf); // use existing zchf

        savings = new Savings(zchf, 20000); // 2%
        roller = new PositionRoller(_zchf);

        factory = new PositionFactory(); // V2
        mintingHub = new MintingHub(_zchf, address(savings), address(roller), address(factory)); // V2
    }

    function initV2() public {
        zchf.transferFrom(msg.sender, address(this), 3_000 ether); // needs allowance
        zchf.suggestMinter(address(savings), 10_000, 1000 ether, "Savings");
        zchf.suggestMinter(address(roller), 10_000, 1000 ether, "Roller");
        zchf.suggestMinter(address(mintingHub), 10_000, 1000 ether, "MintingHubV2");
    }
}
