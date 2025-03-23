// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IGovernance} from "../equity/IGovernance.sol";
import {ITokenPool} from "./ITokenPool.sol";
import {ITokenAdminRegistry} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/ITokenAdminRegistry.sol";
import {RateLimiter} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/RateLimiter.sol";

contract CCIPAdmin {
    uint256 public immutable VETO_PERIOD;
    IGovernance public immutable GOVERNANCE;
    ITokenPool public tokenPool;
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

    error NotAppliable();
    error InvalidUpdate(bytes32 expected, bytes32 given);
    error AlreadySet();

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

    constructor(IGovernance _governance, ITokenAdminRegistry _tokenAdminRegistry, uint64 _vetoPeriod, address _zchf) {
        GOVERNANCE = _governance;
        VETO_PERIOD = _vetoPeriod;
        TOKEN_ADMIN_REGISTRY = _tokenAdminRegistry;
        ZCHF = _zchf;
    }

    /**
     * @notice Sets the token pool to administer and sets in in the TokenAdminRegistry
     * @dev The token pool can only be set once
     * @param _tokenPool The token pool to set
     */
    function setTokenPool(ITokenPool _tokenPool) external {
        if (address(tokenPool) != address(0)) {
            revert AlreadySet();
        }
        tokenPool = _tokenPool;
        TOKEN_ADMIN_REGISTRY.setPool(ZCHF, address(_tokenPool));
    }

    /**
     * @notice Accepts the admin role transfer on the TokenAdminRegistry
     */
    function acceptAdmin() public {
        TOKEN_ADMIN_REGISTRY.acceptAdminRole(ZCHF);
    }

    /**
     * @notice Accepts ownership transfer on the TokenPool
     */
    function acceptOwnership() public {
        tokenPool.acceptOwnership();
    }

    /**
     * @notice Proposed a remote pool update
     * @dev The contract only stores the hash. So the data has to be passed in during apply again
     * @param _update  The update proposal
     * @param _helpers Helpers needed to be qualified
     */
    function proposeRemotePoolUpdate(
        RemotePoolUpdate memory _update,
        address[] calldata _helpers
    ) external onlyQualified(msg.sender, _helpers) {
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

    /**
     * @notice Proposed a rate limit update
     * @dev The contract only stores the hash. So the data has to be passed in during apply again
     * @param _update  The update proposal
     * @param _helpers Helpers needed to be qualified
     */
    function proposeChainRateLimiterUpdate(
        ChainRateLimiterUpdate calldata _update,
        address[] calldata _helpers
    ) external onlyQualified(msg.sender, _helpers) {
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

    /**
     * @notice Propose to add or remove remote chains
     * @dev The contract only stores the hash. So the data has to be passed in during apply again
     * @param _update  The update proposal
     * @param _helpers Helpers needed to be qualified
     */
    function proposeRemoteChainUpdate(
        RemoteChainUpdate calldata _update,
        address[] calldata _helpers
    ) external onlyQualified(msg.sender, _helpers) {
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

    /**
     * @notice Proposed a new admin for the TokenPool and Admin on the Token registry
     * @dev Useful to transfer to a new CCIPAdmin contract
     * @param _newAdmin  The address of the new admin
     * @param _helpers Helpers needed to be qualified
     */
    function proposeAdminTransfer(
        address _newAdmin,
        address[] calldata _helpers
    ) external onlyQualified(msg.sender, _helpers) {
        proposedAdmin = _newAdmin;
        adminDeadline = uint64(block.timestamp + VETO_PERIOD);

        emit AdminTransferProposed({
            newAdmin: _newAdmin,
            deadline: uint64(block.timestamp + VETO_PERIOD),
            proposer: msg.sender
        });
    }

    /**
     * @notice Veto a proposal
     * @param _proposalType What type of proposal gets vetoed
     * @param _helpers Helpers needed to be qualified
     */
    function vetoProposal(
        ProposalType _proposalType,
        address[] calldata _helpers
    ) external onlyQualified(msg.sender, _helpers) {
        if (_proposalType == ProposalType.REMOTE_POOL) {
            remotePoolUpdateDeadline = 0;
        } else if (_proposalType == ProposalType.CHAIN_RATE_LIMIT) {
            chainRateLimiterDeadline = 0;
        } else if (_proposalType == ProposalType.REMOTE_CHAINS) {
            remoteChainDeadline = 0;
        } else if (_proposalType == ProposalType.ADMIN_TRANSFER) {
            adminDeadline = 0;
        }

        emit ProposalVetoed(_proposalType);
    }

    /**
     * @notice Apply a proposal. Only works if VETO_PERIOD has been awaited.
     * @param _proposalType What type of proposal gets vetoed
     * @param _updateData Abi encoded data required to perform the update.
     */
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

    /**
     * @notice Applies the update on the TokenPool
     * @param update RemotePoolUpdate information
     */
    function _applyRemotePoolUpdate(RemotePoolUpdate memory update) private {
        if (update.add) {
            tokenPool.addRemotePool(update.remoteChainSelector, update.remotePoolAddress);
        } else {
            tokenPool.removeRemotePool(update.remoteChainSelector, update.remotePoolAddress);
        }
        remotePoolUpdateDeadline = 0;
        emit RemotePoolUpdateApplied(update.add, update.remoteChainSelector, update.remotePoolAddress);
    }

    /**
     * @notice Applies the rate limit update
     * @dev Bulk function that allows multiple updates at once
     * @param update ChainRateLimiterUpdate information
     */
    function _applyChainRateLimiterUpdate(ChainRateLimiterUpdate memory update) private {
        tokenPool.setChainRateLimiterConfigs(
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

    /**
     * @notice Applies the remote chain updates
     * @dev Bulk function that allows multiple updates at once
     * @param update RemoteChainUpdate information
     */
    function _applyRemoteChainUpdate(RemoteChainUpdate memory update) private {
        tokenPool.applyChainUpdates(update.chainsToRemove, update.chainsToAdd);
        remoteChainDeadline = 0;
        emit RemoteChainUpdateApplied({
            remoteChainSelectorsRemoved: update.chainsToRemove,
            remoteChainsAdded: update.chainsToAdd
        });
    }

    /**
     * @notice Applies the admin transfer
     * @dev Transfers admin on the TokenPool and ownership on the ZCHF token on the TokenAdminRegistry
     */
    function _applyAdminTransfer() private {
        address newAdmin = proposedAdmin;
        TOKEN_ADMIN_REGISTRY.transferAdminRole(ZCHF, newAdmin);
        tokenPool.transferOwnership(newAdmin);
        adminDeadline = 0;
        emit AdminTransfered({newAdmin: newAdmin});
    }

    /**
     * @notice Checks if a proposal is appliable
     */
    function _checkAppliable(uint64 _deadline) private view {
        if (_deadline > block.timestamp || _deadline == 0) {
            revert NotAppliable();
        }
    }

    /**
     * @notice Checks if a given hash matches the expected hash
     * @dev Used by applyProposal to verify the input data
     * @param _expected Hash to match against
     * @param _given Given hash to match the expected hash
     */
    function _checkHash(bytes32 _expected, bytes32 _given) private pure {
        if (_expected != _given) {
            revert InvalidUpdate(_expected, _given);
        }
    }
}
