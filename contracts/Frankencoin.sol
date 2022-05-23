// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC20.sol";
import "./IReservePool.sol";
import "./IFrankencoin.sol";

contract Frankencoin is ERC20, IFrankencoin {

   uint256 private constant MINTER_REMOVED = 1;

   uint256 public constant MIN_FEE = 1000 * (10**18);
   uint256 public constant MIN_APPLICATION_PERIOD = 1000 * (10**18);

   address public immutable reserve;
   uint256 public reserveRequirement;

   mapping (address => uint256) public minters;

   event MinterApplied(address indexed minter, uint256 applicationPeriod, uint256 applicationFee);
   event MinterDenied(address indexed minter);

   constructor(address _reserve) ERC20(18){
      reserve = _reserve;
   }

   function name() external pure returns (string memory){
      return "Frankencoin V1";
   }

   function symbol() external pure returns (string memory){
      return "ZCHF";
   }

   function suggestMinter(address minter, uint256 applicationPeriod, uint256 applicationFee) external {
      require(applicationPeriod >= MIN_APPLICATION_PERIOD || totalSupply() == 0, "period too short");
      require(applicationFee >= MIN_FEE || totalSupply() == 0, "fee too low");
      require(minters[minter] == 0);
      _transfer(msg.sender, reserve, applicationFee);
      minters[minter] = block.timestamp + applicationPeriod;
      emit MinterApplied(minter, applicationPeriod, applicationFee);
   }

   function denyMinter(address minter, address[] calldata helpers) external {
      require(block.timestamp <= minters[minter], "too late");
      require(IReservePool(reserve).isQualified(msg.sender, helpers), "not qualified");
      delete minters[minter];
      emit MinterDenied(minter);
   }

   function mintAndCall(address target, uint256 amount, uint256 reserveRequirementIncrement) external {
      mint(target, amount, reserveRequirementIncrement);
      IERC677Receiver(target).onTokenTransfer(msg.sender, amount, new bytes(0));
   }

   function mint(address target, uint256 amount, uint256 reserveRequirementIncrement) public {
      require(isMinter(msg.sender), "not approved minter");
      reserveRequirement += reserveRequirementIncrement;
      _mint(target, amount);
   }

   function burn(address target, uint256 amount, uint256 reserveRequirementDecrement) external {
      require(isMinter(msg.sender), "not approved minter");
      reserveRequirement -= reserveRequirementDecrement;
      _burn(target, amount);
   }

   function burn(uint256 amount) external {
      _burn(msg.sender, amount);
   }

   function notifyLoss(uint256 amount) external {
      require(isMinter(msg.sender));
      _transfer(reserve, msg.sender, amount);
   }

   function isMinter(address minter) public view returns (bool){
      return block.timestamp > minters[minter];
   }

   function reserves() external view returns (uint256) {
      return balanceOf(reserve);
   }

   function hasEnoughReserves() external view returns (bool){
      return balanceOf(reserve) >= reserveRequirement;
   }

}
