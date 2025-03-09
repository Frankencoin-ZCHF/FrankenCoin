// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IGovernance} from "../equity/IGovernance.sol";
import {ITokenPool} from "./ITokenPool.sol";
import {ITokenAdminRegistry} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/ITokenAdminRegistry.sol";
import {RateLimiter} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/RateLimiter.sol";

contract CCIPAdmin {
    uint256 public immutable VETO_PERIOD;
    IGovernance public immutable GOVERNANCE;
    ITokenPool public immutable TOKEN_POOL;
    ITokenAdminRegistry public immutable TOKEN_ADMIN_REGISTRY;
    address public immutable ZCHF;

    enum ProposalType {
        REMOTE_POOL,
        CHAIN_RATE_LIMIT,
        REMOTE_CHAINS,
        ADMIN_TRANSFER
    }

    struct RemotePoolUpdate {
        uint64 remoteChainSelector;
        bytes remotePoolAddress;
        bool add; // true if adding, false if removing
    }

    struct ChainRateLimiterUpdate {
        uint64[] remoteChainSelectors;
        RateLimiter.Config[] outboundConfigs;
        RateLimiter.Config[] inboundConfigs;
    }

    struct RemoteChainUpdate {
        uint64[] chainsToRemove;
        ITokenPool.ChainUpdate[] chainsToAdd;
    }

    bytes32 public proposedRemotePoolUpdate;
    bytes32 public proposedChainRateLimiterUpdate;
    bytes32 public proposedRemoteChainUpdate;
    address public proposedAdmin;

    uint64 public remotePoolUpdateDeadline;
    uint64 public chainRateLimiterDeadline;
    uint64 public remoteChainDeadline;
    uint64 public adminDeadline;

    error NotReady(uint64 deadline);
    error NotVetoable();
    error NotAppliable();
    error InvalidUpdate(bytes32 expected, bytes32 given);

    event RemotePoolUpdateProposed(
        RemotePoolUpdate update,
        bytes32 updateHash,
        uint64 indexed vetoDeadline,
        address indexed proposer
    );
    event ChainRateLimitUpdateProposed(
        ChainRateLimiterUpdate update,
        bytes32 updateHash,
        uint64 indexed vetoDeadline,
        address indexed proposer
    );
    event RemoteChainUpdateProposed(
        RemoteChainUpdate update,
        bytes32 updateHash,
        uint64 indexed vetoDeadline,
        address indexed proposer
    );
    event AdminTransferProposed(address newAdmin, uint64 indexed deadline, address indexed proposer);
    event ProposalVetoed(ProposalType proposalType);

    event RemotePoolUpdateApplied(bool add, uint64 indexed remoteChainSelector, bytes indexed remotePoolAddress);
    event ChainRateLimiterUpdateApplied(
        uint64[] remoteChainSelectors,
        RateLimiter.Config[] outboundConfigs,
        RateLimiter.Config[] inboundConfigs
    );
    event RemoteChainUpdateApplied(uint64[] remoteChainSelectorsRemoved, ITokenPool.ChainUpdate[] remoteChainsAdded);
    event AdminTransfered(address newAdmin);

    modifier onlyQualified(address sender, address[] calldata helpers) {
        GOVERNANCE.checkQualified(sender, helpers);
        _;
    }

    modifier onlyReady(uint64 deadline) {
        if (deadline != 0) {
            revert NotReady(deadline);
        }
        _;
    }

    constructor(
        IGovernance _governance,
        ITokenPool _tokenPool,
        ITokenAdminRegistry _tokenAdminRegistry,
        uint64 _vetoPeriod,
        address _zchf
    ) {
        GOVERNANCE = _governance;
        TOKEN_POOL = _tokenPool;
        VETO_PERIOD = _vetoPeriod;
        TOKEN_ADMIN_REGISTRY = _tokenAdminRegistry;
        ZCHF = _zchf;

        _tokenAdminRegistry.acceptAdminRole(_zchf);
        _tokenAdminRegistry.setPool(_zchf, address(_tokenPool));
        _tokenPool.acceptOwnership();
    }

    function proposeRemotePoolUpdate(
        RemotePoolUpdate memory _update,
        address[] calldata _helpers
    ) external onlyReady(remotePoolUpdateDeadline) onlyQualified(msg.sender, _helpers) {
        bytes32 updateHash = keccak256(abi.encode(_update));
        proposedRemotePoolUpdate = updateHash;
        remotePoolUpdateDeadline = uint64(block.timestamp + VETO_PERIOD);

        emit RemotePoolUpdateProposed({
            update: _update,
            updateHash: updateHash,
            vetoDeadline: uint64(block.timestamp + VETO_PERIOD),
            proposer: msg.sender
        });
    }

    function proposeChainRateLimiterUpdate(
        ChainRateLimiterUpdate calldata _update,
        address[] calldata _helpers
    ) external onlyReady(chainRateLimiterDeadline) onlyQualified(msg.sender, _helpers) {
        bytes32 updateHash = keccak256(abi.encode(_update));
        proposedChainRateLimiterUpdate = keccak256(abi.encode(_update));
        chainRateLimiterDeadline = uint64(block.timestamp + VETO_PERIOD);

        emit ChainRateLimitUpdateProposed({
            update: _update,
            updateHash: updateHash,
            vetoDeadline: uint64(block.timestamp + VETO_PERIOD),
            proposer: msg.sender
        });
    }

    function proposeRemoteChainUpdate(
        RemoteChainUpdate calldata _update,
        address[] calldata _helpers
    ) external onlyReady(remoteChainDeadline) onlyQualified(msg.sender, _helpers) {
        bytes32 updateHash = keccak256(abi.encode(_update));
        proposedRemoteChainUpdate = updateHash;
        remoteChainDeadline = uint64(block.timestamp + VETO_PERIOD);

        emit RemoteChainUpdateProposed({
            update: _update,
            updateHash: updateHash,
            vetoDeadline: uint64(block.timestamp + VETO_PERIOD),
            proposer: msg.sender
        });
    }

    function proposeAdminTransfer(
        address _newAdmin,
        address[] calldata _helpers
    ) external onlyReady(adminDeadline) onlyQualified(msg.sender, _helpers) {
        proposedAdmin = _newAdmin;
        adminDeadline = uint64(block.timestamp + VETO_PERIOD);

        emit AdminTransferProposed({
            newAdmin: _newAdmin,
            deadline: uint64(block.timestamp + VETO_PERIOD),
            proposer: msg.sender
        });
    }

    function vetoProposal(
        ProposalType _proposalType,
        address[] calldata _helpers
    ) external onlyQualified(msg.sender, _helpers) {
        if (_proposalType == ProposalType.REMOTE_POOL) {
            _checkVeto(remotePoolUpdateDeadline);
            remotePoolUpdateDeadline = 0;
        } else if (_proposalType == ProposalType.CHAIN_RATE_LIMIT) {
            _checkVeto(chainRateLimiterDeadline);
            chainRateLimiterDeadline = 0;
        } else if (_proposalType == ProposalType.REMOTE_CHAINS) {
            _checkVeto(remoteChainDeadline);
            remoteChainDeadline = 0;
        } else if (_proposalType == ProposalType.ADMIN_TRANSFER) {
            _checkVeto(adminDeadline);
            adminDeadline = 0;
        }

        emit ProposalVetoed(_proposalType);
    }

    function applyProposal(ProposalType _proposalType, bytes calldata _updateData) external {
        if (_proposalType == ProposalType.REMOTE_POOL) {
            _checkAppliable(remotePoolUpdateDeadline);
            _checkHash(proposedRemotePoolUpdate, keccak256(_updateData));
            _applyRemotePoolUpdate(abi.decode(_updateData, (RemotePoolUpdate)));
        } else if (_proposalType == ProposalType.CHAIN_RATE_LIMIT) {
            _checkAppliable(chainRateLimiterDeadline);
            _checkHash(proposedChainRateLimiterUpdate, keccak256(_updateData));
            _applyChainRateLimiterUpdate(abi.decode(_updateData, (ChainRateLimiterUpdate)));
        } else if (_proposalType == ProposalType.REMOTE_CHAINS) {
            _checkAppliable(remoteChainDeadline);
            _checkHash(proposedRemoteChainUpdate, keccak256(_updateData));
            _applyRemoteChainUpdate(abi.decode(_updateData, (RemoteChainUpdate)));
        } else if (_proposalType == ProposalType.ADMIN_TRANSFER) {
            _checkAppliable(adminDeadline);
            _applyAdminTransfer();
        }
    }

    function _applyRemotePoolUpdate(RemotePoolUpdate memory update) private {
        if (update.add) {
            TOKEN_POOL.addRemotePool(update.remoteChainSelector, update.remotePoolAddress);
        } else {
            TOKEN_POOL.removeRemotePool(update.remoteChainSelector, update.remotePoolAddress);
        }
        remotePoolUpdateDeadline = 0;
        emit RemotePoolUpdateApplied(update.add, update.remoteChainSelector, update.remotePoolAddress);
    }

    function _applyChainRateLimiterUpdate(ChainRateLimiterUpdate memory update) private {
        TOKEN_POOL.setChainRateLimiterConfigs(
            update.remoteChainSelectors,
            update.outboundConfigs,
            update.inboundConfigs
        );
        chainRateLimiterDeadline = 0;
        emit ChainRateLimiterUpdateApplied({
            remoteChainSelectors: update.remoteChainSelectors,
            outboundConfigs: update.outboundConfigs,
            inboundConfigs: update.inboundConfigs
        });
    }

    function _applyRemoteChainUpdate(RemoteChainUpdate memory update) private {
        TOKEN_POOL.applyChainUpdates(update.chainsToRemove, update.chainsToAdd);
        remoteChainDeadline = 0;
        emit RemoteChainUpdateApplied({
            remoteChainSelectorsRemoved: update.chainsToRemove,
            remoteChainsAdded: update.chainsToAdd
        });
    }

    function _applyAdminTransfer() private {
        address newAdmin = proposedAdmin;
        TOKEN_ADMIN_REGISTRY.transferAdminRole(ZCHF, newAdmin);
        TOKEN_POOL.transferOwnership(newAdmin);
        adminDeadline = 0;
        emit AdminTransfered({newAdmin: newAdmin});
    }

    function _isOngoing(uint64 _deadline) private view returns (bool) {
        if (_deadline > block.timestamp) {
            return true;
        }
        return false;
    }

    function _checkVeto(uint64 _deadline) private view {
        if (!_isOngoing(_deadline)) {
            revert NotVetoable();
        }
    }

    function _checkAppliable(uint64 _deadline) private view {
        if (_isOngoing(_deadline) || _deadline == 0) {
            revert NotAppliable();
        }
    }

    function _checkHash(bytes32 _expected, bytes32 _given) private pure {
        if (_expected != _given) {
            revert InvalidUpdate(_expected, _given);
        }
    }
}
