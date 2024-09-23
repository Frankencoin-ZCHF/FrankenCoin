// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/ERC20.sol";

contract TestToken is ERC20 {
    string public name;
    string public symbol;

    constructor(string memory name_, string memory symbol_, uint8 dec) ERC20(dec) {
        name = name_;
        symbol = symbol_;

        _mint(msg.sender, 1_000_000 * 10 ** dec);
    }

    function mint(address _account, uint256 _amount) external {
        _mint(_account, _amount);
    }
}
