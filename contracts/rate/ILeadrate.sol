// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ILeadrate {
   function currentRatePPM() external view returns (uint24);
   function currentTicks() external view returns (uint64);
}

struct LeadrateSyncMessage {
   uint24 newRatePPM;
}