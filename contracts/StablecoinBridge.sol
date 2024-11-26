// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IDecentralizedEURO} from "./interface/IDecentralizedEURO.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Stable Coin Bridge
 * @notice A minting contract for another Euro stablecoin ('source stablecoin') that we trust.
 * @author dEURO
 */
contract StablecoinBridge {
    IERC20 public immutable eur; // the source stablecoin
    IDecentralizedEURO public immutable dEURO; // the dEURO

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
     */
    function mintTo(address target, uint256 amount) public {
        eur.transferFrom(msg.sender, address(this), amount);
        _mint(target, amount);
    }

    function _mint(address target, uint256 amount) internal {
        if (block.timestamp > horizon) revert Expired(block.timestamp, horizon);
        dEURO.mint(target, amount);
        minted += amount;
        if (minted > limit) revert Limit(amount, limit);
    }

    /**
     * @notice Convenience method for burnAndSend(msg.sender, amount)
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
        dEURO.burnFrom(dEUROHolder, amount);
        eur.transfer(target, amount);
        minted -= amount;
    }
}
