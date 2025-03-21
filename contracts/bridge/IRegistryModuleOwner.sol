// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IRegistryModuleOwner {
    function registerAdminViaGetCCIPAdmin(address token) external;
    function registerAdminViaOwner(address token) external;
}