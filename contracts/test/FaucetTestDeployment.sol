// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestToken.sol";
import "../utils/Ownable.sol";
import "../interface/IFrankencoin.sol";

contract FaucetTestDeployment is Ownable {
    IERC20[] public tokens;
    IFrankencoin public zchf;

    bool public init = false;
    uint256 public tokenCnt = 0;

    event NewToken(uint256 id, string name, string symbol, address token);
    event NewZchf(address member, address to, uint256 amount);
    event NewMint(address member, address to, uint256 amount);

    constructor() {
        _setOwner(msg.sender);
    }

    function setZchf(address _zchf) public onlyOwner {
        zchf = IFrankencoin(_zchf); // needs suggest minter
    }

    function initTokens() public onlyOwner {
        require(init == false, "Already done");
        createToken("Wrapped Bitcoin", "WBTC", 8);
        createToken("Uniswap", "UNI", 18);
        createToken("Supercoin", "SUP", 18);
        createToken("Bees Protocol", "BEES", 4); // use dif. decs
        createToken("Boss AG", "BOSS", 0); // use dif. decs
        createToken("Unreal", "REALU", 9); // use dif. decs
        init = true;
    }

    function mintZchfTo(address to, uint256 amount) public {
        zchf.mint(to, amount);
        emit NewZchf(msg.sender, to, amount);
    }
    function mintZchf() public {
        zchf.mint(msg.sender, 100_000 ether);
    }

    function createToken(string memory name, string memory symbol, uint8 dec) public onlyOwner {
        TestToken newToken = new TestToken(name, symbol, dec);
        tokens.push(newToken);
        emit NewToken(tokenCnt, name, symbol, address(newToken));
        tokenCnt++;
    }

    function mintTo(address to, uint256 amount) public {
        mintZchf();
        for (uint256 i = 0; i < tokenCnt; i++) {
            TestToken token = TestToken(address(tokens[i]));
            token.mint(to, amount * 10 ** token.decimals());
        }
        emit NewMint(msg.sender, to, amount);
    }

    function mint() public {
        mintTo(msg.sender, 1000);
    }
}
