// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./utils/ERC20PermitLight.sol";
import "./Equity.sol";
import "./interface/IReserve.sol";
import "./interface/IFrankencoin.sol";

/**
 * @title Bridged Frankencoin ERC-20 Token
 * 
 * Like its mainnet counterpart, it has the capapbility to add minting modules. This allows to
 * potentially add similar collateralized minting methods as in the mainnet Frankencoin.
 * 
 * However, there is only one FPS, the one on mainnet and voting power has to be projected onto the
 * side chains.
 */
contract Frankencoin is ERC20PermitLight {

    /**
     * @notice Minimal fee and application period when suggesting a new minter.
     */
    uint256 public constant MIN_FEE = 1000 * (10 ** 18);
    uint256 public immutable MIN_APPLICATION_PERIOD; // for example 10 days

    uint256 internal constant DISABLE_MINTER_ALLOWANCE = INFINITY + 1;

    /**
     * @notice Map of minters to approval time stamps. If the time stamp is in the past, the minter contract is allowed
     * to mint Frankencoins.
     */
    mapping(address minter => uint256 validityStart) public minters;

    /**
     * @notice List of positions that are allowed to mint and the minter that registered them.
     */
    mapping(address position => address registeringMinter) public positions;

    event MinterApplied(address indexed minter, uint256 applicationPeriod, uint256 applicationFee, string message);
    event MinterDenied(address indexed minter, string message);

    error PeriodTooShort();
    error FeeTooLow();
    error AlreadyRegistered();
    error NotMinter();
    error TooLate();

    modifier minterOnly() {
        if (!isMinter(msg.sender) && !isMinter(positions[msg.sender])) revert NotMinter();
        _;
    }

    /**
     * @notice Initiates the Frankencoin with the provided minimum application period for new plugins
     * in seconds, for example 10 days, i.e. 3600*24*10 = 864000
     */
    constructor(uint256 _minApplicationPeriod) ERC20(18) {
        MIN_APPLICATION_PERIOD = _minApplicationPeriod;
        reserve = new Equity(this);
    }

    function name() external pure override returns (string memory) {
        return "Frankencoin";
    }

    function symbol() external pure override returns (string memory) {
        return "ZCHF";
    }

    function initialize(address _minter, string calldata _message) external {
        require(totalSupply() == 0 && reserve.totalSupply() == 0);
        minters[_minter] = block.timestamp;
        emit MinterApplied(_minter, 0, 0, _message);
    }

    /**
     * @notice Publicly accessible method to suggest a new way of minting Frankencoin.
     * @dev The caller has to pay an application fee that is irrevocably lost even if the new minter is vetoed.
     * The caller must assume that someone will veto the new minter unless there is broad consensus that the new minter
     * adds value to the Frankencoin system. Complex proposals should have application periods and applications fees
     * above the minimum. It is assumed that over time, informal ways to coordinate on new minters emerge. The message
     * parameter might be useful for initiating further communication. Maybe it contains a link to a website describing
     * the proposed minter.
     *
     * @param _minter              An address that is given the permission to mint Frankencoins
     * @param _applicationPeriod   The time others have to veto the suggestion, at least MIN_APPLICATION_PERIOD
     * @param _applicationFee      The fee paid by the caller, at least MIN_FEE
     * @param _message             An optional human readable message to everyone watching this contract
     */
    function suggestMinter(
        address _minter,
        uint256 _applicationPeriod,
        uint256 _applicationFee,
        string calldata _message
    ) external override {
        if (_applicationPeriod < MIN_APPLICATION_PERIOD) revert PeriodTooShort();
        if (_applicationFee < MIN_FEE) revert FeeTooLow();
        if (minters[_minter] != 0) revert AlreadyRegistered();
        _collectProfits(address(this), msg.sender, _applicationFee);
        minters[_minter] = block.timestamp + _applicationPeriod;
        emit MinterApplied(_minter, _applicationPeriod, _applicationFee, _message);
    }

    /**
     * @notice Make the system more user friendly by skipping the allowance in many cases.
     * @dev We trust minters and the positions they have created to mint and burn as they please, so
     * giving them arbitrary allowances does not pose an additional risk.
     */
    function _allowance(address owner, address spender) internal view override returns (uint256) {
        uint256 explicit = super._allowance(owner, spender);
        if ((explicit == 0 || explicit == DISABLE_MINTER_ALLOWANCE) && canMint(spender)){
            // if there is no allowance set (or minters explicitely disabled), we check for minter's allowance           
            return explicit == DISABLE_MINTER_ALLOWANCE ? 0 : INFINITY;
        }
        return explicit;
    }

    /**
     * @notice Allows minters to register collateralized debt positions, thereby giving them the ability to mint Frankencoins.
     * @dev It is assumed that the responsible minter that registers the position ensures that the position can be trusted.
     */
    function registerPosition(address _position) external override {
        if (!isMinter(msg.sender)) revert NotMinter();
        positions[_position] = msg.sender;
    }

    /**
     * @notice Qualified pool share holders can deny minters during the application period.
     * @dev Calling this function is relatively cheap thanks to the deletion of a storage slot.
     */
    function denyMinter(address _minter, address[] calldata _helpers, string calldata _message) external override {
        if (block.timestamp > minters[_minter]) revert TooLate();
        bridge.checkQualified(msg.sender, _helpers);
        delete minters[_minter];
        emit MinterDenied(_minter, _message);
    }

    function mint(address _target, uint256 _amount) external override minterOnly {
        _mint(_target, _amount);
    }

    /**
     * Anyone is allowed to burn their ZCHF.
     */
    function burn(uint256 _amount) external {
        _burn(msg.sender, _amount);
    }

    /**
     * @notice Burn someone elses ZCHF.
     */
    function burnFrom(address _owner, uint256 _amount) external override minterOnly {
        _burn(_owner, _amount);
    }

    function canMint(address _minterOrPosition) public view returns (bool) {
        return isMinter(_minterOrPosition) || isMinter(positions[_minterOrPosition]);
    }

    /**
     * @notice Returns true if the address is an approved minter.
     */
    function isMinter(address _minter) public view override returns (bool) {
        return minters[_minter] != 0 && block.timestamp >= minters[_minter];
    }

    /**
     * @notice Returns the address of the minter that created this position or null if the provided address is unknown.
     */
    function getPositionParent(address _position) public view override returns (address) {
        return positions[_position];
    }
}
