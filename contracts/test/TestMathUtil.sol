// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../MathUtil.sol";

contract TestMathUtil is MathUtil {
    
    function cubicRoot(uint256 _v) external pure returns (uint256) {
        return _cubicRoot(_v);
    }
    
    function mulD18(uint256 _a, uint256 _b) external pure returns(uint256) {
        return _mulD18(_a, _b);
    }

    function divD18(uint256 _a, uint256 _b) external pure returns(uint256) {
        return _divD18(_a, _b);
    }

    function power3(uint256 _x) external pure returns(uint256) {
        return _power3(_x);
    }
}
