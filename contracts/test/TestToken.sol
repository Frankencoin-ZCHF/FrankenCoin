// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../ERC20.sol";

contract TestToken is ERC20 {

  string public name;
  string public symbol;

  constructor(string memory name_, string memory symbol_) ERC20(18) {
    name = name_;
    symbol = symbol_;
  }

  function mint(address _account, uint256 _amount) external {
    _mint(_account, _amount);
  }
}
