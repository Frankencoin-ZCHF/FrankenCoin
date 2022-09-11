// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC20.sol";
import "./Equity.sol";
import "./IReserve.sol";
import "./IFrankencoin.sol";

contract Frankencoin is ERC20, IFrankencoin {

   uint256 public constant MIN_FEE = 1000 * (10**18);
   uint256 public constant MIN_APPLICATION_PERIOD = 10 days;

   IReserve override public immutable reserve;
   uint256 public minterReserve;

   mapping (address => uint256) public minters;
   mapping (address => address) public positions;

   event MinterApplied(address indexed minter, uint256 applicationPeriod, uint256 applicationFee, string message);
   event MinterDenied(address indexed minter, string message);

   constructor() ERC20(18){
      reserve = new Equity(this);
   }

   function name() override external pure returns (string memory){
      return "Frankencoin V1";
   }

   function symbol() override external pure returns (string memory){
      return "ZCHF";
   }

   function suggestMinter(address _minter, uint256 _applicationPeriod, 
      uint256 _applicationFee, string calldata _message) override external 
   {
      require(_applicationPeriod >= MIN_APPLICATION_PERIOD || totalSupply() == 0, "period too short");
      require(_applicationFee >= MIN_FEE || totalSupply() == 0, "fee too low");
      require(minters[_minter] == 0, "already registered");
      _transfer(msg.sender, address(reserve), _applicationFee);
      minters[_minter] = block.timestamp + _applicationPeriod;
      emit MinterApplied(_minter, _applicationPeriod, _applicationFee, _message);
   }

   function registerPosition(address _position) override external {
      require(isMinter(msg.sender), "not minter");
      positions[_position] = msg.sender;
   }

   /**
    * @notice Get reserve balance (amount of ZCHF)
    * @return ZCHF in dec18 format
    */
   function equity() public view returns (uint256) {
      uint256 balance = balanceOf(address(reserve));
      if (balance <= minterReserve){
        return 0;
      } else {
        return balance - minterReserve;
      }
    }

   function denyMinter(address _minter, address[] calldata _helpers, string calldata _message) override external {
      require(block.timestamp <= minters[_minter], "too late");
      require(reserve.isQualified(msg.sender, _helpers), "not qualified");
      delete minters[_minter];
      emit MinterDenied(_minter, _message);
   }

   /**
 * @notice Mint amount of ZCHF for address _target
 * @param _target       address that receives ZCHF if it's a minter
 * @param _amount       amount ZCHF before fees and pool contribution requested
 *                      number in dec18 format
 * @param _reservePPM   reserve requirement in parts per million
 * @param _feesPPM      fees in parts per million
 */
   function mint(address _target, uint256 _amount, uint32 _reservePPM, uint32 _feesPPM) 
      override external minterOnly 
   {
      uint256 reserveAmount = _amount * _reservePPM;
      uint256 mintAmount = reserveAmount / 1000_000;
      uint256 fees = (_amount * _feesPPM) / 1000_000;
      _mint(_target, _amount - mintAmount - fees);
      _mint(address(reserve), mintAmount + fees);
      minterReserve += reserveAmount;
   }

   /**
    * @notice Mint amount of ZCHF for address _target
    * @param _target   address that receives ZCHF if it's a minter
    * @param _amount   amount in dec18 format
    */
   function mint(address _target, uint256 _amount) override external minterOnly {
      _mint(_target, _amount);
   }

   function burn(uint256 _amount) external {
      _burn(msg.sender, _amount);
   }

   /* function burn(uint256 amount, uint32 reservePPM) external override minterOnly returns (uint256) {
      _burn(msg.sender, amount);
      minterReserve -= amount * reservePPM / 1000000;
   } */

   function burnWithReserve(uint256 _amountExcludingReserve, uint32 _reservePPM) 
      external override minterOnly returns (uint256) 
   {
      _burn(msg.sender, _amountExcludingReserve); // 41
      uint256 currentReserve = balanceOf(address(reserve)); // 18
      uint256 adjustedReservePPM = currentReserve < minterReserve ? _reservePPM * currentReserve / minterReserve : _reservePPM; // 18%
      uint256 freedAmount = adjustedReservePPM * _amountExcludingReserve / (1000000 - adjustedReservePPM); // 41/0.82 = 50
      uint256 freedReserve = _reservePPM * freedAmount / 1000000; // 10
      minterReserve -= freedReserve; // reduce reserve requirements by original increment
      _burn(address(reserve), adjustedReservePPM * freedAmount / 1000000); // only burn the share of the reserve that is still there
      assert (freedAmount == _amountExcludingReserve + adjustedReservePPM * freedAmount / 1000000); // TODO: probably subject to rounding errors
      return freedAmount;
   }

   function burn(address _owner, uint256 _amount) override external minterOnly {
      _burn(_owner, _amount);
   }

   modifier minterOnly() {
      require(isMinter(msg.sender) || isMinter(positions[msg.sender]), "not approved minter");
      _;
   }

   function notifyLoss(uint256 _amount) override external minterOnly {
      uint256 reserveLeft = balanceOf(address(reserve));
      if (reserveLeft >= _amount){
         _transfer(address(reserve), msg.sender, _amount);
      } else {
         _transfer(address(reserve), msg.sender, reserveLeft);
         _mint(msg.sender, _amount - reserveLeft);
      }
   }

   function isMinter(address _minter) override public view returns (bool){
      return minters[_minter]!=0 && block.timestamp > minters[_minter];
   }

   function isPosition(address _position) override public view returns (address){
      return positions[_position];
   }

}
