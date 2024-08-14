// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interface/IFrankencoin.sol";
import "./interface/IReserve.sol";

contract FlashLoan {
    IFrankencoin public immutable zchf;
    uint256 public constant FLASHLOAN_MAX = 1_000_000 ether;
    uint256 public constant FLASHLOAN_FEEPPM = 1_000;
    uint256 public cooldown;

    // ---------------------------------------------------------------------------------------------------
    // Mappings
    mapping(address => uint256) public senderMinted;
    mapping(address => uint256) public senderRepaid;
    mapping(address => uint256) public senderFees;

    // ---------------------------------------------------------------------------------------------------
    // Events
    event Denied(address indexed denier, string message);
    event Minted(address indexed to, uint256 amount);
    event Repaid(address indexed from, uint256 total, uint256 repay, uint256 fee);
    
    // ---------------------------------------------------------------------------------------------------
    // Errors
    error Cooldown();
    error ExceedsLimit();
    error NotPaidBack();
    error DelegateCallFailed();

    // ---------------------------------------------------------------------------------------------------
    // Modifier
    modifier noCooldown() {
       if (block.timestamp <= cooldown) revert Cooldown();
        _;
    }

    // ---------------------------------------------------------------------------------------------------
    constructor(address _zchf) {
        zchf = IFrankencoin(_zchf);
        cooldown = block.timestamp + 3 days;

        zchf.transferFrom(msg.sender, address(this), 1000 ether);
        zchf.suggestMinter(address(this), 3 days, 1000 ether, "FlashLoanV0");
    }

    // ---------------------------------------------------------------------------------------------------
    function deny(address[] calldata helpers, string calldata message) external noCooldown {
        IReserve(zchf.reserve()).checkQualified(msg.sender, helpers);
        cooldown = type(uint256).max;
        emit Denied(msg.sender, message);
    }

    // ---------------------------------------------------------------------------------------------------
    function _verify(address sender) internal view noCooldown {
        uint256 total = senderMinted[sender] * (1_000_000 + FLASHLOAN_FEEPPM);
        uint256 repaid = senderRepaid[sender] * 1_000_000;
        uint256 fee = senderFees[sender] * 1_000_000;
        if (repaid + fee < total) revert NotPaidBack();
    }

    // ---------------------------------------------------------------------------------------------------
    function takeLoan(
        uint256 amount, 
        address[] memory targets,
        bytes[] memory calldatas
    ) public noCooldown {
        if (amount > FLASHLOAN_MAX) revert ExceedsLimit();
        _verify(msg.sender);

        // mint flash loan
        senderMinted[msg.sender] += amount;
        zchf.mint(msg.sender, amount);
        emit Minted(msg.sender, amount);

        // execute all
        for (uint256 i = 0; i < targets.length; ++i) {
            (bool success, ) = targets[i].delegatecall(calldatas[i]);
            if (!success) revert DelegateCallFailed();
        }
        
        // verify after
        _verify(msg.sender);
    }

    // @dev: i might be limited to msg.sender calls, due to _allowance as a minter
    // You can call this method multiple times to repay within a tx, in the end _verify needs to pass.
    // ---------------------------------------------------------------------------------------------------
    function repayLoan(uint256 amount) public noCooldown {
        uint256 fee = amount * FLASHLOAN_FEEPPM / 1_000_000;
        uint256 repay = amount - fee;

        zchf.burnFrom(msg.sender, repay);
        zchf.transferFrom(msg.sender, address(zchf.reserve()), fee); 

        senderRepaid[msg.sender] += repay;
        senderFees[msg.sender] += fee;
        
        emit Repaid(msg.sender, amount, repay, fee);
    }
}