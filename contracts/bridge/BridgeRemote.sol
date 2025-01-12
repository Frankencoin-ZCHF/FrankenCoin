pragma solidity ^0.8.0;

import "./BridgedFrankencoin.sol";

/**
 * @title Bridge
 */
contract BridgeRemote {

    BridgedFrankencoin immutable ZCHF;

    // As long as there are accrued losses, bridging back to mainnet should be blocked
    uint256 accruedLosses;

    mapping (address=>uint256) public votes;
    uint256 public totalVotes;

    constructor(BridgedFrankencoin zchf){
        ZCHF = zchf;
    }

    function collectProfits(address source, uint256 _amount) external override minterOnly {
        _collectProfits(msg.sender, source, _amount);
    }

    function _collectProfits(address minter, address source, uint256 _amount) internal {
        emit Profit(minter, _amount);
        if (accruedLosses > 0){
            uint256 toBurn = min(accruedLosses, _amount);
            _amount -= toBurn;
            accruedLosses -= toBurn;
            ZCHF.burnFrom(source, toBurn);
        }
        if (_amount > 0){
            _transfer(source, address(this), _amount);
        }
    }

    function coverLoss(address source, uint256 _amount) external override minterOnly {
        uint256 reserves = ZCHF.balanceOf(address(this));
        if (reserves < _amount){
            uint256 toMint = _amount - reserves;
            ZCHF.mint(address(this), toMint);
            accruedLosses += toMint;
        }
        _transfer(address(this), source, _amount);
        emit Loss(source, _amount);
    }

    modifier minterOnly() {
        if (!isMinter(msg.sender) && !isMinter(positions[msg.sender])) revert NotMinter();
        _;
    }

    modifier mainnetOnly() {
        // ensure this can only be called remotely from the corresponding mainnet contract
        _;
    }

    function updateInterest(address rateModule, uint24 interestPPM) external mainnetOnly {
        IBridgedLeadrate(rateModule).updateRate(interestPPM);
    }

    function updateVotes(address voter, uint256 votes, uint256 totalVotes_) external mainnetOnly {
        votes[voter] = votes;
        totalVotes = totalVotes;
    }

    function transferToMainnet(address target, uint256 amount) external {
        zchf.burnFrom(msg.sender, amount);
        uint256 transferredLoss = min(accruedLosses, amount);
        // send message to mainnet: receive(target, amount, transferredLoss);
        accruedLosses -= transferredLoss;
    }

    function checkQualified(address sender, address[] calldata helpers) external view{
        return votes[sender] * 100 > totalVotes * 2; // at least 2%, delegation must be done on mainnet
    }

}

interface IBridgedLeadrate {
   function updateRate(uint24 interestPPM) external;
}