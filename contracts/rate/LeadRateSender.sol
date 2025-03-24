pragma solidity ^0.8.0;

import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {SyncVote, SyncMessage} from "./BridgedGovernanceTypes.sol";
import {Governance} from "./Governance.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {IERC20} from "../erc20/IERC20.sol";

/**
 * @title Leadrate (attempt at translating the nicely concise German term 'Leitzins')
 *
 * A module that can provide other modules with the lead interest rate for the system.
 *
 **/
contract LeadrateSender {

    Leadrate public immutable BASIS;
    IRouterClient public immutable ROUTER;

    constructor(Leadrate basis, address router){
        BASIS = basis;
        ROUTER = router;
    }

    function pushLeadrate(uint64[] chains, address[] bridgedLeadrates) external {
        applyPendingChanges();
        for (uint256 i=0; i<chains.length; i++){
            push(chains[i], bridgedLeadrates[i]);
        }
    }

    function pushLeadrate(uint64 chain, address bridgedLeadrate) external {
        applyPendingChanges();
        push(chain, bridgedLeadrate);
    }

    function push(uint64 chain, address bridgedLeadrate) internal {
        uint24 rate = BASIS.currentRatePPM();
        // create message and send the rate through the router
    }

    function applyPendingChanges() internal {
        if (BASIS.currentRatePPM() != BASIS.nextRatePPM() && BASIS.nextChange < block.timestamp) {
            BASIS.applyChange(); // there is a pending change to apply
        }
    }

}