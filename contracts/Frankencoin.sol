// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC20.sol";

contract Frankencoin is ERC20 {

   uint256 public constant MAX_FEE = 1000 * (10**18);

   uint256 public required;

   address public immutable brain;
   mapping (address => uint256) public minters;

   event MinterApplied(address indexed minter);
   event MinterDenied(address indexed minter);

   constructor(address _brain) ERC20(18){
      brain = _brain;
   }

   function name() external pure returns (string memory){
      return "Frankencoin V1";
   }

   function symbol() external pure returns (string memory){
      return "ZCHF";
   }

   function applyForMinting() public payable {
      // Charge an application fee
      uint256 fee = totalSupply() / 1000;
      _transfer(msg.sender, brain, fee > MAX_FEE ? MAX_FEE : fee);
      minters[msg.sender] = block.timestamp + 2 weeks;
      emit MinterApplied(msg.sender);
   }

   function denyMinter(address minter) external {
      require(msg.sender == brain, "not brain");
      require(block.timestamp < minters[msg.sender], "already approved");
      delete minters[minter];
      emit MinterDenied(minter);
   }

   modifier minterOnly {
      require(block.timestamp > minters[msg.sender], "not an approved minter");
      _;
   }

   function mint(address target, uint256 amount, uint32 capitalRatio) external minterOnly {
      uint256 capital = balanceOf(brain);
      required += amount * capitalRatio / 1000000;
      require(capital >= required, "insufficient equity");
      _mint(target, amount);
   }

   function burn(address owner, uint256 amount, uint32 capitalRatio) external minterOnly {
      _burn(owner, amount);
      required -= amount * capitalRatio / 1000000;
   }
}
