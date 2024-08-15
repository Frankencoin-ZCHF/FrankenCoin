// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interface/IFrankencoin.sol";
import "./interface/IReserve.sol";

contract FlashLoan {
    IFrankencoin public immutable zchf;
    string public constant NAME = "FlashLoanV0";
    uint256 public constant FLASHLOAN_TOTALMAX = 10_000_000 ether;
    uint256 public constant FLASHLOAN_MAX = 1_000_000 ether;
    uint256 public constant FLASHLOAN_FEEPPM = 1_000;
    uint256 public constant FLASHLOAN_DELAY = 10; // 10sec for testing
    uint256 public totalMinted = 0;
    uint256 public cooldown;

    // ---------------------------------------------------------------------------------------------------
    // Mappings
    mapping(address => uint256) public senderMinted;
    mapping(address => uint256) public senderRepaid;
    mapping(address => uint256) public senderFees;

    // ---------------------------------------------------------------------------------------------------
    // Events
    event Shutdown(address indexed denier, string message);
    event LoanTaken(address indexed to, uint256 amount, uint256 totalMint);
    event Repaid(address indexed from, uint256 total, uint256 repay, uint256 fee);
    
    // ---------------------------------------------------------------------------------------------------
    // Errors
    error Cooldown();
    error ExceedsLimit();
    error ExceedsTotalLimit();
    error NotPaidBack();
    error DelegateCallFailed();
    error PaidTooMuch();

    // ---------------------------------------------------------------------------------------------------
    // Modifier
    modifier noCooldown() {
       if (block.timestamp <= cooldown) revert Cooldown();
        _;
    }

    // ---------------------------------------------------------------------------------------------------
    constructor(address _zchf) {
        zchf = IFrankencoin(_zchf);
        cooldown = block.timestamp + FLASHLOAN_DELAY;
    }

    // ---------------------------------------------------------------------------------------------------
    function shutdown(address[] calldata helpers, string calldata message) external noCooldown {
        IReserve(zchf.reserve()).checkQualified(msg.sender, helpers);
        cooldown = type(uint256).max;
        emit Shutdown(msg.sender, message);
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
        if (amount + totalMinted > FLASHLOAN_TOTALMAX) revert ExceedsTotalLimit();
        if (amount > FLASHLOAN_MAX) revert ExceedsLimit();
        _verify(msg.sender);

        // mint flash loan
        totalMinted += amount;
        senderMinted[msg.sender] += amount;
        zchf.mint(msg.sender, amount);
        emit LoanTaken(msg.sender, amount, totalMinted);

        // execute all
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, bytes memory returnData) = targets[i].delegatecall(calldatas[i]);
            if (!success) revert(_revertMessage(returnData));
        }
        
        // verify after
        _verify(msg.sender);
    }

    // revert message
    function _revertMessage(bytes memory returndata) internal pure returns (string memory) {
        if (returndata.length < 4) return "Delegatecall failed silently";

        if (returndata.length == 4) {
            assembly {
                returndata := mload(add(returndata, 0x20))
            }
        } else {
            assembly {
                returndata := add(returndata, 0x04)
            }
        }

        return abi.decode(returndata, (string)); 
    }

    // @dev: i might be limited to msg.sender calls, due to _allowance as a minter
    // You can call this method multiple times to repay within a tx, in the end _verify needs to pass.
    // ---------------------------------------------------------------------------------------------------
    function repayLoan(uint256 amount) public noCooldown {
        uint256 fee = amount * FLASHLOAN_FEEPPM / 1_000_000;
        uint256 total = amount + fee;
        if (senderRepaid[msg.sender] + amount > senderMinted[msg.sender]) revert PaidTooMuch();

        zchf.burnFrom(msg.sender, amount);
        zchf.transferFrom(msg.sender, address(zchf.reserve()), fee); 

        senderRepaid[msg.sender] += amount;
        senderFees[msg.sender] += fee;
        
        emit Repaid(msg.sender, total, amount, fee);
    }
}