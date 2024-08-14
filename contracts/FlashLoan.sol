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
    event Minted(address indexed sender, uint256 amount);
    event Repaid(address indexed behalfOf, uint256 amount, uint256 repay, uint256 fee);
    
    // ---------------------------------------------------------------------------------------------------
    // Errors
    error Cooldown();

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
        require(repaid + fee >= total, "Not paid bacm");
    }

    // ---------------------------------------------------------------------------------------------------
    function takeLoan(
        uint256 amount, 
        address[] memory targets,
        bytes[] memory calldatas
    ) public noCooldown {
        require(amount <= FLASHLOAN_MAX, "Exceeds limit");
        _verify(msg.sender);

        // mint flash loan
        senderMinted[msg.sender] += amount;
        zchf.mint(msg.sender, amount);
        emit Minted(msg.sender, amount);

        // execute all
        for (uint256 i = 0; i < targets.length; ++i) {
            (bool success, ) = targets[i].delegatecall(calldatas[i]);
            require(success, "Ext. call failed");
        }
        
        // verify after
        _verify(msg.sender);
    }

    // ---------------------------------------------------------------------------------------------------
    function repayLoan(address behalfOf, uint256 amount) public noCooldown {
        zchf.transferFrom(behalfOf, address(this), amount);

        uint256 fee = amount * FLASHLOAN_FEEPPM / 1_000_000;
        uint256 repay = amount - fee;

        senderRepaid[behalfOf] += repay;
        senderFees[behalfOf] += fee;

        zchf.transferFrom(address(this), address(zchf.reserve()), fee);
        emit Repaid(behalfOf, amount, repay, fee);
    }
}