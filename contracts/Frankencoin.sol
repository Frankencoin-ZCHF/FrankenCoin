// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC20PermitLight.sol";
import "./Equity.sol";
import "./IReserve.sol";
import "./IFrankencoin.sol";

/**
 * The Frankencoin (ZCHF) is an ERC-20 token that is designed to track the value of the Swiss franc.
 * It is not upgradable, but open to arbitrary minting plugins. These are automatically accepted if none of the
 * qualified pool share holders casts a veto, leading to a flexible but conservative governance.
 */
contract Frankencoin is ERC20PermitLight, IFrankencoin {

   /**
    * Minimal fee and application period when suggesting a new minter.
    */
   uint256 public constant MIN_FEE = 1000 * (10**18);
   uint256 public immutable MIN_APPLICATION_PERIOD; // for example 10 days

   /**
    * The contract that holds the reserve.
    */
   IReserve override public immutable reserve;

   /**
    * How much of the reserve belongs to the minters.
    * Everything else belongs to the pool share holders.
    * Stored with 6 additional digits of accuracy so no rounding is necessary
    * when dealing with parts per million (ppm) in reserve calculations.
    */
   uint256 private minterReserveE6;

   /**
    * Map of minters to approval time stamps. If the time stamp is in the past, the minter contract is allowed
    * to mint Frankencoins.
    */
   mapping (address => uint256) public minters;

   /**
    * List of positions that are allowed to mint and the minter that registered them.
    */
   mapping (address => address) public positions;

   event MinterApplied(address indexed minter, uint256 applicationPeriod, uint256 applicationFee, string message);
   event MinterDenied(address indexed minter, string message);

   /**
    * Initiates the Frankencoin with the provided minimum application period for new plugins
    * in seconds, for example 10 days, i.e. 3600*24*10 = 864000
    */
   constructor(uint256 _minApplicationPeriod) ERC20(18){
      MIN_APPLICATION_PERIOD = _minApplicationPeriod;
      reserve = new Equity(this);
   }

   function name() override external pure returns (string memory){
      return "Frankencoin";
   }

   function symbol() override external pure returns (string memory){
      return "ZCHF";
   }

   /**
    * Publicly accessible method to suggest a new way of minting Frankencoin.
    *
    * The caller has to pay an application fee that is irrevocably lost even if the new minter is vetoed.
    *
    * The caller must assume that someone will veto the new minter unless there is broad consensus that the new minter
    * adds value to the Frankencoin system. Complex proposals should have application periods and applications fees above
    * the minimum. It is assumed that over time, informal ways to coordinate on new minters emerge. The message parameter
    * might be useful for initiating further communication. Maybe it contains a link to a website describing the proposed
    * minter.
    */
   function suggestMinter(address _minter, uint256 _applicationPeriod, uint256 _applicationFee, string calldata _message) override external {
      if (_applicationPeriod < MIN_APPLICATION_PERIOD && totalSupply() > 0) revert PeriodTooShort();
      if (_applicationFee < MIN_FEE  && totalSupply() > 0) revert FeeTooLow();
      if (minters[_minter] != 0) revert AlreadyRegistered();
      _transfer(msg.sender, address(reserve), _applicationFee);
      minters[_minter] = block.timestamp + _applicationPeriod;
      emit MinterApplied(_minter, _applicationPeriod, _applicationFee, _message);
   }

   error PeriodTooShort();
   error FeeTooLow();
   error AlreadyRegistered();

   /**
    * Make the system more user friendly by skipping the allowance in many cases.
    *
    * We trust minters and the positions they have created to mint and burn as they please, so
    * giving them arbitraty allowances does not pose an additional risk.
    */
   function allowanceInternal(address owner, address spender) internal view override returns (uint256) {
      uint256 explicit = super.allowanceInternal(owner, spender);
      if (explicit > 0){
         return explicit; // don't waste gas checking minter
      } else if (isMinter(spender) || isMinter(isPosition(spender))){
         return INFINITY;
      } else {
         return 0;
      }
   }

   /**
    * The reserve provided by the owners of collateralized positions.
    * The minter reserve can be used to cover losses after all else failed and the equity holders have already been wiped out.
    */
   function minterReserve() public view returns (uint256) {
      return minterReserveE6 / 1000000;
   }

   /**
    * Registers a collateralized debt position, thereby giving it the ability to mint Frankencoins.
    * It is assumed that the responsible minter that registers the position ensures that the position can be trusted.
    */
   function registerPosition(address _position) override external {
      if (!isMinter(msg.sender)) revert NotMinter();
      positions[_position] = msg.sender;
   }

   error NotMinter();

   /**
    * The amount of equity of the Frankencoin system in ZCHF, owned by the holders of Frankencoin Pool Shares.
    * Note that the equity contract technically holds both the minter reserve as well as the equity, so the minter
    * reserve must be subtracted. All fees and other kind of income is added to the Equity contract and essentially
    * constitutes profits attributable to the pool share holders.
    */
   function equity() public view returns (uint256) {
      uint256 balance = balanceOf(address(reserve));
      uint256 minReserve = minterReserve();
      if (balance <= minReserve){
        return 0;
      } else {
        return balance - minReserve;
      }
    }

   /**
    * Qualified pool share holders can deny minters during the application period.
    * Calling this function is relatively cheap thanks to the deletion of a storage slot.
    */
   function denyMinter(address _minter, address[] calldata _helpers, string calldata _message) override external {
      if (block.timestamp > minters[_minter]) revert TooLate();
      reserve.checkQualified(msg.sender, _helpers);
      delete minters[_minter];
      emit MinterDenied(_minter, _message);
   }

   error TooLate();

   /**
    * Mints the provided amount of ZCHF to the target address, automatically forwarding
    * the minting fee and the reserve to the right place.
    */
   function mint(address _target, uint256 _amount, uint32 _reservePPM, uint32 _feesPPM) override external minterOnly {
      uint256 usableMint = (_amount * (1000_000 - _feesPPM - _reservePPM)) / 1000_000; // rounding down is fine
      _mint(_target, usableMint);
      _mint(address(reserve), _amount - usableMint); // rest goes to equity as reserves or as fees
      minterReserveE6 += _amount * _reservePPM; // minter reserve must be kept accurately in order to ensure we can get back to exactly 0
   }

   function mint(address _target, uint256 _amount) override external minterOnly {
      _mint(_target, _amount);
   }

   /**
    * Anyone is allowed to burn their ZCHF.
    */
   function burn(uint256 _amount) external {
      _burn(msg.sender, _amount);
   }

   /**
    * Burn that amount without reclaiming the reserve, but freeing it up and thereby essentially donating it to the pool
    * share holders. This can make sense in combination with 'notifyLoss', i.e. when it is the pool share holders that bear the risk
    * and depending on the outcome they make a profit or a loss.
    *
    * Design rule: Minters calling this method are only allowed to so for tokens amounts they previously minted with the same _reservePPM amount.
    *
    * For example, if someone minted 50 ZCHF earlier with a 20% reserve requirement (200000 ppm), they got 40 ZCHF and paid
    * 10 ZCHF into the reserve. Now they want to repay the debt by burning 50 ZCHF. When doing so using this method, 50 ZCHF get
    * burned and on top of that, 10 ZCHF previously assigned to the minter's reserved are reassigned to the pool share holders.
    */
   function burn(uint256 amount, uint32 reservePPM) external override minterOnly {
      _burn(msg.sender, amount);
      minterReserveE6 -= amount * reservePPM;
   }

   /**
    * Calculates the reserve attributable to someone who minted the given amount with the given reserve requirement.
    * Under normal circumstances, this is just the reserver requirement multiplied by the amount. However, after a severe loss
    * of capital that burned into the minter's reserve, this can also be less than that.
    */
   function calculateAssignedReserve(uint256 mintedAmount, uint32 _reservePPM) public view returns (uint256) {
      uint256 theoreticalReserve = _reservePPM * mintedAmount / 1000000;
      uint256 currentReserve = balanceOf(address(reserve));
      if (currentReserve < minterReserve()){
         // not enough reserves, owner has to take a loss
         return theoreticalReserve * currentReserve / minterReserve();
      } else {
         return theoreticalReserve;
      }
   }

   /**
    * Burns the target amount taking the tokens to be burned from the payer and the payer's reserve.
    * The caller is only allowed to use this method for tokens also minted through the caller with the same _reservePPM amount.
    *
    * Example: the calling contract has previously minted 100 ZCHF with a reserve ratio of 20% (i.e. 200000 ppm). To burn half
    * of that again, the minter calls burnFrom with a target amount of 50 ZCHF. Assuming that reserves are only 90% covered,
    * this call will deduct 41 ZCHF from the payer's balance and 9 from the reserve, while reducing the minter reserve by 10.
    */
   function burnFrom(address payer, uint256 targetTotalBurnAmount, uint32 _reservePPM) external override minterOnly returns (uint256) {
      uint256 assigned = calculateAssignedReserve(targetTotalBurnAmount, _reservePPM);
      _transfer(address(reserve), payer, assigned); // send reserve to owner
      _burn(payer, targetTotalBurnAmount); // and burn the full amount from the owner's address
      minterReserveE6 -= targetTotalBurnAmount * _reservePPM; // reduce reserve requirements by original ratio
      return assigned;
   }

   /**
    * Calculate the amount that is freed when returning amountExcludingReserve given a reserve ratio of reservePPM, taking
    * into account potential losses. Example values in the comments.
    */
   function calculateFreedAmount(uint256 amountExcludingReserve /* 41 */, uint32 reservePPM /* 20% */) public view returns (uint256){
      uint256 currentReserve = balanceOf(address(reserve)); // 18, 10% below what we should have
      uint256 minterReserve_ = minterReserve(); // 20
      uint256 adjustedReservePPM = currentReserve < minterReserve_ ? reservePPM * currentReserve / minterReserve_ : reservePPM; // 18%
      return 1000000 * amountExcludingReserve / (1000000 - adjustedReservePPM); // 41 / (1-18%) = 50
   }

   /**
    * Burns the provided number of tokens plus whatever reserves are associated with that amount given the reserve requirement.
    * The caller is only allowed to use this method for tokens also minted through the caller with the same _reservePPM amount.
    *
    * Example: the calling contract has previously minted 100 ZCHF with a reserve ratio of 20% (i.e. 200000 ppm). Now they have
    * 41 ZCHF that they do not need so they decide to repay that amount. Assuming the reserves are only 90% covered,
    * the call to burnWithReserve will burn the 41 plus 9 from the reserve, reducing the outstanding 'debt' of the caller by
    * 50 ZCHF in total. This total is returned by the method so the caller knows how much less they owe.
    */
   function burnWithReserve(uint256 _amountExcludingReserve, uint32 _reservePPM) external override minterOnly returns (uint256) {
      uint256 freedAmount = calculateFreedAmount(_amountExcludingReserve, _reservePPM);
      minterReserveE6 -= freedAmount * _reservePPM; // reduce reserve requirements by original ratio
      _transfer(address(reserve), msg.sender, freedAmount - _amountExcludingReserve); // collect assigned reserve, maybe less than original reserve
      _burn(msg.sender, freedAmount); // burn the rest of the freed amount
      return freedAmount;
   }

   /**
    * Burn someone elses ZCHF.
    */
   function burn(address _owner, uint256 _amount) override external minterOnly {
      _burn(_owner, _amount);
   }

   modifier minterOnly() {
      if (!isMinter(msg.sender) && !isMinter(positions[msg.sender])) revert NotMinter();
      _;
   }

   /**
    * Notify the Frankencoin that a minter lost economic access to some coins. This does not mean that the coins
    * are literally lost. It just means that some ZCHF will likely never be repaid and that in order to bring the system
    * back into balance, the lost amount of ZCHF must be removed from the reserve instead.
    *
    * For example, if a minter printed 1 million ZCHF for a mortgage and the mortgage turned out to be unsound with the
    * house only yielding 800'000 in the subsequent auction, there is a loss of 200'000 that needs to be covered by the 
    * reserve.
    */
   function notifyLoss(uint256 _amount) override external minterOnly {
      uint256 reserveLeft = balanceOf(address(reserve));
      if (reserveLeft >= _amount){
         _transfer(address(reserve), msg.sender, _amount);
      } else {
         _transfer(address(reserve), msg.sender, reserveLeft);
         _mint(msg.sender, _amount - reserveLeft);
      }
   }

   /**
    * Returns true if the address is an approved minter.
    */
   function isMinter(address _minter) override public view returns (bool){
      return minters[_minter] != 0 && block.timestamp >= minters[_minter];
   }

   /**
    * Returns the address of the minter that created this position or null if the provided address is unknown.
    */
   function isPosition(address _position) override public view returns (address){
      return positions[_position];
   }

}

