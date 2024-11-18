// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ERC20.sol";
import "./ERC20PermitLight.sol";
import "../Equity.sol";

contract DEPSWrapper is ERC20 {

    Equity private immutable nDEPS;

    constructor(Equity nDEPS_) ERC20(18){
        nDEPS = nDEPS_;
    }

    function name() external pure override returns (string memory) {
        return "Native Decentralized Euro Protocol Share";
    }

    function symbol() external pure override returns (string memory) {
        return "nDEPS";
    }

    // requires allowance
    function wrap(uint256 amount) public {
        depositFor(msg.sender, amount);
    }

    /**
     * Same function as in openzeppelin ERC20Wrapper
     * @dev Allow a user to deposit underlying tokens and mint the corresponding number of wrapped tokens.
     */
    function depositFor(address account, uint256 amount) public virtual returns (bool) {
        nDEPS.transferFrom(msg.sender, address(this), amount);
        super._mint(account, amount);
        return true;
    }

    function unwrap(uint256 amount) public {
        withdrawTo(msg.sender, amount);
    }

    /**
     * Same function as in openzeppelin ERC20Wrapper
     * @dev Allow a user to burn a number of wrapped tokens and withdraw the corresponding number of underlying tokens.
     */
    function withdrawTo(address account, uint256 amount) public virtual returns (bool) {
        super._burn(msg.sender, amount);
        nDEPS.transfer(account, amount);
        return true;
    }

    /**
     * @dev Returns the address of the underlying ERC-20 token that is being wrapped.
     */
    function underlying() public view returns (IERC20) {
        return nDEPS;
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