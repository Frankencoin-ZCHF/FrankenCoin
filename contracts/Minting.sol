// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

/** 
 * @title Minting
 * @dev Abstract minting contract ZCHF. Every ZCHF minting contract implements this contract.
 */
abstract contract Minting {

    /** 
    * Returns the reserve requirement ratio r. That is, if the ZCHF minted by this contract is
    * equal to X, then X * r ZCHF collateral is required to be held as collateral in the governance
    * contract.
    * @return int256 number that represents a decimal 18 (if the int number is k, then the corresponding
    *         decimal number equals f=k/1e18)
    */
    function getReserveRequirement() public virtual view returns (int256);
    
    /** 
    * The minting function, applies checks and calls concrete minting function. Sends ZCHF to the message sender
    * @param    collateralTokenAddr  address if the collateral token to be sent into the minting contract
    * @param    fAmount              decimal-18 number specifying the amount of the collateral tokens to be swapped
    * @param    optionMask           depending on the concrete implementation, this field can encode options
    * decimal number equals f=k/1e18)
    */
    function mint(address collateralTokenAddr, int256 fAmount, int256 optionMask) requireAllowList public {
        // TODO: require reserve requirement met
        _mint(collateralTokenAddr, fAmount, optionMask);
    }

    /** 
    * Concrete minting function to be implemented in child contract.
    * @param    collateralTokenAddr  address if the collateral token to be sent into the minting contract
    * @param    fAmount              decimal-18 number specifying the amount of the collateral tokens to be swapped
    * @param    optionMask           depending on the concrete implementation, this field can encode options
    * decimal number equals f=k/1e18)
    */
    function _mint(address collateralTokenAddr, int256 fAmount, int256 optionMask) internal virtual;

    /** 
    * User can redeem their collateral by depositing ZCHF (reverse Minting). Sends the collateral to the
    * message sender. Redeem can be called also if the minting contract is no longer in the allowlist.
    * @param    collateralTokenAddr  address if the collateral token to be sent into the minting contract
    * @param    fAmountZCHF          decimal-18 number specifying the amount of ZCHF to be paid
    * @param    outCollAddr          receiver address for the collateral
    * @param    optionMask           depending on the concrete implementation, this field can encode options
    * @return   int256 number that represents a decimal 18 (if the int number is k, then the corresponding
    * decimal number equals f=k/1e18)
    */
    function redeem(address collateralTokenAddr, int256 fAmountZCHF, int256 optionMask) public {
        // TODO: checks
        _redeem(collateralTokenAddr, fAmountZCHF, optionMask);
    }

    /** 
    * Concrete redeem function to be implemented in child contract. 
    * @param    collateralTokenAddr  address if the collateral token to be sent into the minting contract
    * @param    fAmountZCHF          decimal-18 number specifying the amount of ZCHF to be paid
    * @param    outCollAddr          receiver address for the collateral
    * @param    optionMask           depending on the concrete implementation, this field can encode options
    * @return   int256 number that represents a decimal 18 (if the int number is k, then the corresponding
    * decimal number equals f=k/1e18)
    */
    function _redeem(address collateralTokenAddr, int256 fAmountZCHF, int256 optionMask) internal virtual;

    /** 
    * Partially or fully liquidate a position which is undercollateralized by sending ZCHF.
    * Collateral belonging to the position is sent to the ZCHF sender, proportional to the amount of ZCHF
    * sent. If ZCHF amount exceeds the ZCHF position to be liquidated, the ZCHF amount sent is shrunk.
    * liquidate() can be called also if the minting contract is no longer in the allowlist.
    * @param    positionID      unique ID for the position
    * @param    fAmountZCHF     amount ZCHF (dec 18) to be sent to the contract from the liquidator and to be 
    *                           swapped against collateral
    */
    function liquidatePosition(bytes32 positionID, int256 fAmountZCHF) public {
        // todo: checks: isPositionSafe
        _liquidatePosition(positionID, fAmountZCHF);
    }

    /** 
    * Concrete implementation
    * @param    positionID      unique ID for the position
    * @param    fAmountZCHF     amount ZCHF (dec 18) to be sent to the contract from the liquidator and to be 
    *                           swapped against collateral
    */
    function _liquidatePosition(bytes32 positionID, int256 fAmountZCHF) internal virtual;

    modifier requireAllowList {
      // TODO: check that smart contract is in Governance Contract allowlist
      _;
   }
}
