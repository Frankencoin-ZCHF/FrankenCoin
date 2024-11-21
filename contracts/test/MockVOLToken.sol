// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockVOLToken is ERC20 {
    constructor() ERC20("VOL volatile mock token", "VOL") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }

    function mint(address _account, uint256 _amount) external {
        _mint(_account, _amount);
    }
}
