// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

/** 
 * @title Minting
 * @dev Abstract minting contract ZCHF. Every ZCHF minting contract implements this contract.
 */
abstract contract Minting {

    modifier requireAllowList {
      // TODO: check that smart contract is in Governance Contract allowlist
      _;
    }

    /** 
    * Returns the reserve requirement ratio r. That is, if the ZCHF minted by this contract is
    * equal to X, then X * r ZCHF collateral is required to be held as collateral in the governance
    * contract.
    * @return int256 number that represents a decimal 18 (if the int number is k, then the corresponding
    *         decimal number equals f=k/1e18)
    */
    function getReserveRequirement() public virtual view returns (int256);
    
    /** 
    * Returns the amount of circulating ZCHF minted by this contract. 
    * This amount is reduced
    * with every liquidation and redemption, it is increased by minting. 
    * @return int256 number that represents a decimal 18
    */
    function getCirculatingAmount() public virtual view returns (int256);

    /** 
    * The minting function, applies checks and calls concrete minting function. Sends ZCHF to the message sender
    * @param    _collateralTokenAddr  address if the collateral token to be sent into the minting contract
    * @param    _fAmount              decimal-18 number specifying the amount of the collateral tokens to be swapped
    * @param    _optionMask           depending on the concrete implementation, this field can encode options
    * @return bytes32: position id (trader, collateral, minting contract) AND int256 decimal-18 amount of ZCHF minted) 
    */
    function mint(address _collateralTokenAddr, int256 _fAmount, int256 _optionMask) requireAllowList public returns (bytes32, int256) {
        // TODO: require reserve requirement met
        int256 fAmountZCHF;
        bytes32 positionID = keccak256(abi.encodePacked(msg.sender, _collateralTokenAddr, address(this)));
        fAmountZCHF = _mint(_collateralTokenAddr, _fAmount, _optionMask, positionID);
        require(meetsCollateralRequirement(positionID), "Position must meet collateral requirement after minting");
        require(getPositionOwner(positionID) == msg.sender, "Position must be registered for message sender");
        // TODO: event
        return (positionID, fAmountZCHF);
    }

    /** 
    * Concrete minting function to be implemented in child contract.
    * @param    _collateralTokenAddr  address if the collateral token to be sent into the minting contract
    * @param    _fAmount              decimal-18 number specifying the amount of the collateral tokens to be swapped
    * @param    _optionMask           depending on the concrete implementation, this field can encode options
    * @param    _positionID           bytes32: unique position ID. To be stored in contract.
    * @return amount of ZCHF (decimal-18) minted and sent to msg.sender
    */
    function _mint(address _collateralTokenAddr, int256 _fAmount, int256 _optionMask, bytes32 _positionID) internal virtual returns (int256);

    /** 
    * User can redeem their collateral by depositing ZCHF (reverse Minting). Sends the collateral to the
    * message sender. Redeem can be called also if the minting contract is no longer in the allowlist.
    * @param    _positionID  unique position ID (trader, collateral, minting contract)
    * @param    _fAmountZCHF  decimal-18 number specifying the amount of ZCHF to be paid
    * @param    _optionMask   depending on the concrete implementation, this field can encode options
    */
    function redeem(bytes32 _positionID, int256 _fAmountZCHF, int256 _optionMask) public {
        require(getPositionOwner(_positionID)==msg.sender, "Only position owner can redeem");
        _redeem(_positionID, _fAmountZCHF, _optionMask);
    }

    /** 
    * Concrete redeem function to be implemented in child contract. 
    * @param    _positionID   unique ID of position
    * @param    _fAmountZCHF  decimal-18 number specifying the amount of ZCHF to be paID
    * @param    _optionMask   depending on the concrete implementation, this field can encode options
    */
    function _redeem(bytes32 _positionID, int256 _fAmountZCHF, int256 _optionMask) internal virtual;

    /** 
    * Partially or fully liquidate a position which is undercollateralized by sending ZCHF.
    * Collateral belonging to the position is sent to the ZCHF sender, proportional to the amount of ZCHF
    * sent. If ZCHF amount exceeds the ZCHF position to be liquidated, the ZCHF amount sent is shrunk.
    * liquidate() can be called also if the minting contract is no longer in the allowlist.
    * @param    _positionID      unique ID for the position
    * @param    _fAmountZCHF     amount ZCHF (dec 18) to be sent to the contract from the liquidator and to be 
    *                           swapped against collateral
    */
    function liquidatePosition(bytes32 _positionID, int256 _fAmountZCHF) public {
        require(!meetsCollateralRequirement(_positionID), "position must not meet collateral requirement");
        _liquidatePosition(_positionID, _fAmountZCHF);
    }

    /** 
    * Concrete implementation
    * @param    positionID      unique ID for the position
    * @param    fAmountZCHF     amount ZCHF (dec 18) to be sent to the contract from the liquidator and to be 
    *                           swapped against collateral
    */
    function _liquidatePosition(bytes32 positionID, int256 fAmountZCHF) internal virtual;

    /** 
    * Get the owner address for the given position
    * @param  _positionID unique ID for the position
    * @return address
    */
    function getPositionOwner(bytes32 _positionID) public virtual returns (address);
    
    /** 
    * Checks whether collateral requirement is met. Otherwise trader can be liquidated.
    * @param  _positionID unique ID for the position
    * @return true if collateral requirement met
    */
    function meetsCollateralRequirement(bytes32 _positionID) public virtual returns (bool);
    
}
