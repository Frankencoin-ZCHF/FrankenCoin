// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Governance.sol";

constract BridgedGovernance is Governance, Recipient {

    mapping(address owner => uint256 votes) public votes;

    uint256 public totalVotes;

    constructor(address bridge) Recipient(bridge){
        totalVotes = 1; // to avoid divisions by zero in empty state
    }

    /**
     * @notice The votes of the holder, excluding votes from delegates.
     */
    function votes(address holder) public view returns (uint256){
        return votes[holder];
    }

    /**
     * @notice Total number of votes in the system.
     */
    function totalVotes() abstract public view returns (uint256){
        return totalVotes;
    }

    function reportVotes(uint256 currentTotalVotes, address owner, uint256 votes) external bridgeOnly {
        totalVotes = currentTotalVotes;
        votes[owner] = votes;
    }

    function reportVotes(uint256 currentTotalVotes, address[] owners, uint256[] votes) external bridgeOnly {
        assert currentTotalVotes >= 1;
        totalVotes = currentTotalVotes;
        for (int i=0; i<owners.length; i++){
            votes[owner[i]] = votes[i];
        }
    }

    function reportDelegates(address[] owners, address[] delegates)  external bridgeOnly {
        for (int i=0; i<owners.length; i++){
            delegate(owners[i], delegates[i]);
        }
    }

}