// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Equity} from "../Equity.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Wrapper} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Wrapper.sol";

contract DEPSWrapper is ERC20Permit, ERC20Wrapper {
    Equity private immutable nDEPS;

    constructor(
        Equity nDEPS_
    )
        ERC20Permit("Decentralized Euro Protocol Share")
        ERC20("Decentralized Euro Protocol Share", "DEPS")
        ERC20Wrapper(nDEPS_)
    {
        nDEPS = nDEPS_;
    }

    // requires allowance
    function wrap(uint256 amount) public {
        depositFor(msg.sender, amount);
    }

    function unwrap(uint256 amount) public {
        withdrawTo(msg.sender, amount);
    }

    function decimals() public view override(ERC20, ERC20Wrapper) returns (uint8) {
        return ERC20Wrapper.decimals();
    }

    /**
     * Sell immediately, bypassing the 90 day holding requirement if the
     * average wrapped token has been around for long enough and no one
     * cancelled the votes of this contract. Can help with market making
     * between chains when this token is bridged.
     *
     * Anyone can prevent this method from being executable via the
     * halveHoldingDuration function. Also, it won't be executable in an
     * expanding market where the number of wrapped nDEPS doubles every
     * 90 days such that the average holding period of this contract stays
     * below that duration.
     */
    function unwrapAndSell(uint256 amount) public {
        super._burn(msg.sender, amount);
        nDEPS.redeem(msg.sender, amount);
    }

    /**
     * Reduces the recorded holding duration of the wrapped nDEPS. This has two effects:
     * - Averts the risk of this contract accumulating too many votes over time (i.e. 98%)
     * - Can prevent "unwrapAndSell" from succeeding (which can be desired to prevent short
     *   term arbitrage at the cost of all other nDEPS holders)
     *
     * Anyone with 2% of the votes can call this.
     */
    function halveHoldingDuration(address[] calldata helpers) public {
        nDEPS.checkQualified(msg.sender, helpers);
        // causes our votes to be cut in half
        nDEPS.transfer(address(this), totalSupply());
    }
}
