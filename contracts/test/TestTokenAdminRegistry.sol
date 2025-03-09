// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract TestTokenAdminRegistry {
    event FunctionCalled(string name, bytes args);

    function getPool(address token) external returns (address) {
        emit FunctionCalled("getPool", abi.encode(token));
        return address(0);
    }

    function proposeAdministrator(address localToken, address administrator) external {
        emit FunctionCalled("proposeAdministrator", abi.encode(localToken, administrator));
    }

    function acceptAdminRole(address localToken) external {
        emit FunctionCalled("acceptAdminRole", abi.encode(localToken));
    }

    function setPool(address localToken, address pool) external {
        emit FunctionCalled("setPool", abi.encode(localToken, pool));
    }

    function transferAdminRole(address localToken, address newAdmin) external {
        emit FunctionCalled("transferAdminRole", abi.encode(localToken, newAdmin));
    }
}
