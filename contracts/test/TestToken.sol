// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    uint8 private _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
        _mint(msg.sender, 1_000_000 * 1e18);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address _account, uint256 _amount) external {
        _mint(_account, _amount);
    }
}
