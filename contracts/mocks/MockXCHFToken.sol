// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../ERC20.sol";

contract MockXCHFToken is ERC20 {
    constructor() ERC20(18) {}

    function name() override external pure returns (string memory){
      return "XCHF Mock Token";
   }
    function symbol() override external pure returns (string memory){
      return "XCHF";
    }

    function mint(address _account, uint256 _amount) external {
        _mint(_account, _amount);
    }
}
