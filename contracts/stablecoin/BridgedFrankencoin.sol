// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../equity/BridgedGovernance.sol";
import "../erc20/ERC20PermitLight.sol";
import "../equity/IGovernance.sol";
import "../equity/Equity.sol";
import "./IBasicFrankencoin.sol";
import "../erc20/CrossChainERC20.sol";

/**
 * @title Bridged Frankencoin ERC-20 Token
 *
 * Like its mainnet counterpart, it has the capapbility to add minting modules. This allows to
 * potentially add similar collateralized minting methods as in the mainnet Frankencoin.
 *
 * However, there is only one FPS, the one on mainnet and voting power has to be projected onto the
 * side chains.
 */
contract BridgedFrankencoin is CrossChainERC20, ERC20PermitLight, IBasicFrankencoin {
    /**
     * @notice Minimal fee and application period when suggesting a new minter.
     */
    uint256 public constant MIN_FEE = 1000 * (10 ** 18);
    uint256 public immutable MIN_APPLICATION_PERIOD; // for example 10 days

    /**
     * @notice The contract that holds the reserve.
     */
    IGovernance public immutable override reserve;

    /**
     * @notice Map of minters to approval time stamps. If the time stamp is in the past, the minter contract is allowed
     * to mint Frankencoins.
     */
    mapping(address minter => uint256 validityStart) public minters;

    /**
     * @notice List of positions that are allowed to mint and the minter that registered them.
     */
    mapping(address position => address registeringMinter) public positions;

    uint256 public accruedLoss;

    event SentProfitsHome(uint256 amount);
    event MinterApplied(address indexed minter, uint256 applicationPeriod, uint256 applicationFee, string message);
    event MinterDenied(address indexed minter, string message);
    event Loss(address indexed reportingMinter, uint256 amount);
    event Profit(address indexed reportingMinter, uint256 amount);

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
    constructor(
        IGovernance reserve_,
        address router_,
        uint256 _minApplicationPeriod
    ) ERC20(18) CrossChainERC20(router_) {
        MIN_APPLICATION_PERIOD = _minApplicationPeriod;
        reserve = reserve_;
    }

    function name() external pure override returns (string memory) {
        return "Frankencoin";
    }

    function symbol() external pure override returns (string memory) {
        return "ZCHF";
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
        if (explicit > 0) {
            return explicit; // don't waste gas checking minter
        } else if (isMinter(spender) || isMinter(getPositionParent(spender)) || spender == address(reserve)) {
            return INFINITY;
        } else {
            return 0;
        }
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
        reserve.checkQualified(msg.sender, _helpers);
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
     * @notice Notify the Frankencoin that a minter lost economic access to some coins. This does not mean that the coins are
     * literally lost. It just means that some ZCHF will likely never be repaid and that in order to bring the system
     * back into balance, the lost amount of ZCHF must be removed from the reserve instead.
     *
     * For example, if a minter printed 1 million ZCHF for a mortgage and the mortgage turned out to be unsound with
     * the house only yielding 800'000 in the subsequent auction, there is a loss of 200'000 that needs to be covered
     * by the reserve.
     */
    function coverLoss(address source, uint256 _amount) external minterOnly {
        uint256 reserveLeft = balanceOf(address(reserve));
        if (_amount > reserveLeft) {
            accruedLoss += (_amount - reserveLeft);
            _mint(address(reserve), _amount - reserveLeft);
        }
        _transfer(address(reserve), source, _amount);
        emit Loss(source, _amount);
    }

    function collectProfits(address source, uint256 _amount) external override minterOnly {
        _collectProfits(msg.sender, source, _amount);
    }

    function _collectProfits(address minter, address source, uint256 _amount) internal {
        _transfer(source, address(reserve), _amount);
        if (accruedLoss > _amount) {
            accruedLoss -= _amount;
            _burn(address(reserve), _amount);
        } else if (accruedLoss > 0) {
            _burn(address(reserve), accruedLoss);
            accruedLoss = 0;
        }
        emit Profit(minter, _amount);
    }

    /**
     * Uses a multichain call to send home all accrued profits, if any
     */
    function synchronizeAccounting() external {
        uint256 reserveLeft = balanceOf(address(reserve));
        if (reserveLeft > 0) {
            // TODO: call receiveProfits(reserveLeft); on mainnet contract and send tokens along with it
            emit SentProfitsHome(reserveLeft);
        } else {
            // TODO: call receiveLosses(accruedLoss); on mainnet contract
            accruedLoss = 0;
        }
    }

    /**
     * @notice Returns true if the address is an approved minter.
     */
    function isMinter(address _minter) public view returns (bool) {
        return minters[_minter] != 0 && block.timestamp >= minters[_minter];
    }

    /**
     * @notice Returns the address of the minter that created this position or null if the provided address is unknown.
     */
    function getPositionParent(address _position) public view returns (address) {
        return positions[_position];
    }

}
