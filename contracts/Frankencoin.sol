// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC20.sol";
import "./IReservePool.sol";
import "./IFrankencoin.sol";

contract Frankencoin is ERC20, IFrankencoin {

   uint256 public constant MIN_FEE = 1000 * (10**18);
   uint256 public constant MIN_APPLICATION_PERIOD = 10 days;

   address public immutable reserve;

   mapping (address => uint256) public minters;
   mapping (address => address) public positions;

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
      require(minters[minter] == 0, "already registered");
      _transfer(msg.sender, reserve, applicationFee);
      minters[minter] = block.timestamp + applicationPeriod;
      emit MinterApplied(minter, applicationPeriod, applicationFee);
   }

   function registerPosition(address position) external {
      require(isMinter(msg.sender), "not minter");
      positions[position] = msg.sender;
   }

   function denyMinter(address minter, address[] calldata helpers) external {
      require(block.timestamp <= minters[minter], "too late");
      require(IReservePool(reserve).isQualified(msg.sender, helpers), "not qualified");
      delete minters[minter];
      emit MinterDenied(minter);
   }

   function mint(address target, uint256 amount, uint32 reservePPM, uint32 feesPPM) external minterOnly {
      require(isMinter(msg.sender) || isMinter(positions[msg.sender]), "not approved minter");
      uint256 reserveAmount = amount * reservePPM / 1000000;
      uint256 fees = amount * feesPPM / 1000000;
      _mint(target, amount - reserveAmount - fees);
      _mint(reserve, reserveAmount + fees);
      IERC677Receiver(reserve).onTokenTransfer(msg.sender, reserveAmount, new bytes(0));
   }

   function mint(address target, uint256 amount) external minterOnly {
      _mint(target, amount);
   }

   function burn(uint256 amount) external {
      _burn(msg.sender, amount);
   }

   function burn(address owner, uint256 amount) external minterOnly {
      _burn(owner, amount);
   }

   modifier minterOnly() {
      require(isMinter(msg.sender) || isMinter(positions[msg.sender]), "not approved minter");
      _;
   }

   function notifyLoss(uint256 amount) external minterOnly {
      uint256 reserveLeft = balanceOf(reserve);
      if (reserveLeft >= amount){
         _transfer(reserve, msg.sender, amount);
      } else {
         _transfer(reserve, msg.sender, reserveLeft);
         _mint(msg.sender, amount - reserveLeft);
      }
   }

   function isMinter(address minter) public view returns (bool){
      return block.timestamp > minters[minter];
   }

   function reserves() external view returns (uint256) {
      return balanceOf(reserve);
   }

}
