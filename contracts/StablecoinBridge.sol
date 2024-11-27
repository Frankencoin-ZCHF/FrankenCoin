// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import {IDecentralizedEURO} from "./interface/IDecentralizedEURO.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title Stable Coin Bridge
 * @notice A minting contract for another Euro stablecoin ('source stablecoin') that we trust.
 * @author dEURO
 */
contract StablecoinBridge {
    IERC20 public immutable eur; // the source stablecoin
    IDecentralizedEURO public immutable dEURO; // the dEURO
    uint8 private immutable eurDecimals;
    uint8 private immutable dEURODecimals;

    /**
     * @notice The time horizon after which this bridge expires and needs to be replaced by a new contract.
     */
    uint256 public immutable horizon;

    /**
     * The maximum amount of outstanding converted source stablecoins.
     */
    uint256 public immutable limit;
    uint256 public minted;

    error Limit(uint256 amount, uint256 limit);
    error Expired(uint256 time, uint256 expiration);
    error UnsupportedToken(address token);

    constructor(address other, address dEUROAddress, uint256 limit_, uint256 weeks_) {
        eur = IERC20(other);
        dEURO = IDecentralizedEURO(dEUROAddress);
        eurDecimals = IERC20Metadata(other).decimals();
        dEURODecimals = IERC20Metadata(dEUROAddress).decimals();
        horizon = block.timestamp + weeks_ * 1 weeks;
        limit = limit_;
        minted = 0;
    }

    /**
     * @notice Convenience method for mint(msg.sender, amount)
     */
    function mint(uint256 amount) external {
        mintTo(msg.sender, amount);
    }

    /**
     * @notice Mint the target amount of dEUROs, taking the equal amount of source coins from the sender.
     * @dev This only works if an allowance for the source coins has been set and the caller has enough of them.
     * @param amount The amount of the source stablecoin to bridge (convert).
     */
    function mintTo(address target, uint256 amount) public {
        eur.transferFrom(msg.sender, address(this), amount);
        
        uint256 targetAmount = _convertAmount(amount, eurDecimals, dEURODecimals);
        _mint(target, targetAmount);
    }

    function _mint(address target, uint256 amount) internal {
        if (block.timestamp > horizon) revert Expired(block.timestamp, horizon);
        dEURO.mint(target, amount);
        minted += amount;
        if (minted > limit) revert Limit(amount, limit);
    }

    /**
     * @notice Convenience method for burnAndSend(msg.sender, amount)
     * @param amount The amount of dEURO to burn.
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, msg.sender, amount);
    }

    /**
     * @notice Burn the indicated amount of dEURO and send the same number of source coin to the caller.
     */
    function burnAndSend(address target, uint256 amount) external {
        _burn(msg.sender, target, amount);
    }

    function _burn(address dEUROHolder, address target, uint256 amount) internal {
        uint256 sourceAmount = _convertAmount(amount, dEURODecimals, eurDecimals);
        dEURO.burnFrom(dEUROHolder, amount);
        eur.transfer(target, sourceAmount);
        minted -= amount;
    }

    /**
     * @notice Converts an amount between two tokens with different decimal places.
     * @param amount The amount to convert.
     * @param fromDecimals The decimal places of the source token.
     * @param toDecimals The decimal places of the target token.
     */
    function _convertAmount(uint256 amount, uint8 fromDecimals, uint8 toDecimals) internal pure returns (uint256) {
        if (fromDecimals < toDecimals) {
            return amount * 10**(toDecimals - fromDecimals);
        } else if (fromDecimals > toDecimals) {
            return amount / 10**(fromDecimals - toDecimals);
        } else {
            return amount;
        }
    }
}
