// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Governance.sol";
import "../bridge/Recipient.sol";

/**
 * The bridged equivalent to the equity contract on mainnet.
 * 
 * It allows to project veto power to other chains and it reports
 * losses (costs) back to the main chain.
 */
contract BridgedGovernance is Governance, Recipient {

    mapping(address owner => uint256 votes) private _votes;

    uint256 private _totalVotes;

    constructor(address bridge) Recipient(bridge){
        _totalVotes = 1; // to avoid divisions by zero in empty state
    }

    /**
     * @notice The votes of the holder, excluding votes from delegates.
     */
    function votes(address holder) public override view returns (uint256){
        return _votes[holder];
    }

    /**
     * @notice Total number of votes in the system.
     */
    function totalVotes() public override view returns (uint256){
        return _totalVotes;
    }

    function reportVotes(uint256 currentTotalVotes, address owner, uint256 votes_) external bridgeOnly {
        _totalVotes = currentTotalVotes;
        _votes[owner] = votes_;
    }

    function reportVotes(uint256 currentTotalVotes, address[] calldata owners, uint256[] calldata votes_) external bridgeOnly {
        assert(currentTotalVotes >= 1);
        _totalVotes = currentTotalVotes;
        for (uint i=0; i<owners.length; i++){
            _votes[owners[i]] = votes_[i];
        }
    }

    function reportDelegates(address[] calldata owners, address[] calldata delegates)  external bridgeOnly {
        for (uint i=0; i<owners.length; i++){
            delegate(owners[i], delegates[i]);
        }
    }

}