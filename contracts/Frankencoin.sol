// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC20.sol";

contract Frankencoin is ERC20 {

   uint256 private constant MINTER_REMOVED = 1;

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

   function suggestMinter(address minter) external {
      // Charge an application fee
      uint256 fee = totalSupply() / 1000;
      _transfer(msg.sender, brain, fee > MAX_FEE ? MAX_FEE : fee);
      minters[minter] = block.timestamp + 3 weeks;
      emit MinterApplied(minter);
   }

   function denyMinter(address minter) external {
      require(msg.sender == brain, "not brain");
      if (block.timestamp > minters[minter]){
         minters[minter] = MINTER_REMOVED;
      } else {
         delete minters[minter];
      }
      emit MinterDenied(minter);
   }

   function mint(address target, uint256 amount, uint32 capitalRatio) external {
      uint256 status = minters[msg.sender];
      require(status != 0 && status != MINTER_REMOVED && block.timestamp > status, "not an approved minter");
      required += amount * capitalRatio / 1000000;
      _mint(target, amount);
      uint256 capital = balanceOf(brain);
      require(capital >= required, "insufficient equity"); // do the check in the end in case target is brain
   }

   function burn(address owner, uint256 amount, uint32 capitalRatio) public {
      require(minters[msg.sender] >= MINTER_REMOVED, "never was a minter");
      _burn(owner, amount);
      required -= amount * capitalRatio / 1000000;
   }

   function notifyLoss(uint256 amount, uint32 capitalRatio) external {
      require(minters[msg.sender] >= MINTER_REMOVED, "never was a minter");
      required -= amount * capitalRatio / 1000000;
      required += amount;
   }

   function excessReserves() external view returns (uint256) {
      uint256 balance = balanceOf(brain);
      if (required >= balance){
         return 0;
      } else {
         return balance - required;
      }
   }

}
