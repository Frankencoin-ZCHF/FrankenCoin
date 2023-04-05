// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Strings.sol";
import "./TestToken.sol";
import "../IERC20.sol";
import "../IReserve.sol";
import "../IFrankencoin.sol";
import "../Ownable.sol";
import "../IPosition.sol";
import "../MintingHub.sol";
import "../StablecoinBridge.sol";

/**
 * The central hub for creating, cloning and challenging collateralized Frankencoin positions.
 * Only one instance of this contract is required, whereas every new position comes with a new position
 * contract. Pending challenges are stored as structs in an array.
 */
contract MintingHubTest {

    MintingHub hub;
    StablecoinBridge swap;

    IERC20 xchf;
    TestToken col;
    IFrankencoin zchf;

    User alice;
    User bob;

    address latestPosition;

    constructor(address hub_, address swap_){
        hub = MintingHub(hub_);
        swap = StablecoinBridge(swap_);
        col = new TestToken("Some Collateral", "COL", uint8(0));
        xchf = swap.chf();
        zchf = swap.zchf();
        alice = new User(zchf);
        bob = new User(zchf);
    }

    function initiatePosition() public {
        alice.obtainFrankencoins(swap, 1000 ether);
        latestPosition = alice.initiatePosition(col, hub);
        require(col.balanceOf(address(alice)) == 0);
    }

    function letAliceMint() public {
        alice.mint(latestPosition, 1); // test small amount to provoke rounding error
        alice.mint(latestPosition, 7);
        alice.mint(latestPosition, 0);
        alice.mint(latestPosition, 100000 * (10 ** 18) - 8);
    }

    function letBobMint() public {
        bob.mint(latestPosition, 1);
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
        bridge.mint(amount);
    }

    function initiatePosition(TestToken col, MintingHub hub) public returns (address) {
        col.mint(address(this), 1000);
        col.approve(address(hub), 1000);
        uint256 balanceBefore = zchf.balanceOf(address(this));
        address pos = hub.openPosition(address(col), 100, 1000, 1000000 ether, 100 days, 1 days, 25000, 100 * (10 ** 36), 200000);
        require(col.balanceOf(address(pos)) == 1000);
        require((balanceBefore - hub.OPENING_FEE()) == zchf.balanceOf(address(this)));
        return pos;
    }

    function mint(address pos, uint256 amount) public {
        uint256 balanceBefore = zchf.balanceOf(address(this));
        IPosition(pos).mint(address(this), amount);
        uint256 obtained = zchf.balanceOf(address(this)) - balanceBefore;
        uint256 usable = IPosition(pos).getUsableMint(amount, true);
        require(obtained == usable, string(abi.encodePacked(Strings.toString(usable), " should be ", Strings.toString(obtained))));
    }

}