// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IGovernance} from "../equity/IGovernance.sol";
import {ITokenPool} from "./ITokenPool.sol";
import {IRegistryModuleOwner} from "./IRegistryModuleOwner.sol";
import {ITokenAdminRegistry} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/ITokenAdminRegistry.sol";
import {RateLimiter} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/RateLimiter.sol";
import {BridgeAccounting} from "../equity/BridgeAccounting.sol";

/**
 * The admin for briding Frankencoins using CCIP.
 * Each chain needs an instance of this administrator.
 */
contract CCIPAdmin {

    uint64 public constant DAY = 24 * 60 * 60;

    IGovernance public immutable GOVERNANCE;
    ITokenPool public tokenPool;
    ITokenAdminRegistry public immutable TOKEN_ADMIN_REGISTRY;
    address public immutable ZCHF;
    BridgeAccounting public immutable BRIDGE_ACCOUNTING;

    struct RemotePoolUpdate {
        bool add; // true if adding, false if removing
        uint64 chain;
        bytes poolAddress;
    }

    mapping(bytes32 hash => uint64 deadline) public proposals;

    error TooEarly(uint64 deadline);
    error UnknownProposal(bytes32 hash);
    error ProposalAlreadyMade(bytes32 hash);
    error AlreadySet();

    event ProposalMade(bytes32 hash, uint64 deadline);
    event ProposalDenied(bytes32 hash);
    event ProposalEnacted(bytes32 hash);

    event RemotePoolUpdateProposed(bytes32 hash, address indexed proposer, RemotePoolUpdate update);
    event RemoveChainProposed(bytes32 hash, address indexed proposer, uint64 chain);
    event AddChainProposed(bytes32 hash, address indexed proposer, ITokenPool.ChainUpdate update);
    event AdminTransferProposed(bytes32 hash, address indexed proposer, address newAdmin);
    event AccountingSenderProposed(bytes32 hash, uint64 indexed chain, bytes indexed sender);

    event RemotePoolAdded(uint64 indexed chain, bytes indexed poolAddress);
    event RemotePoolRemoved(uint64 indexed chain, bytes indexed poolAddress);
    event ChainRemoved(uint64 id);
    event ChainAdded(ITokenPool.ChainUpdate config);
    event AdminTransfered(address newAdmin);
    event RateLimit(uint64 remoteChain, RateLimiter.Config inboundConfigs, RateLimiter.Config outboundConfig);
    event AccountingSenderAdded(uint64 indexed chain, bytes indexed sender);

    modifier onlyQualified(address[] calldata helpers) {
        GOVERNANCE.checkQualified(msg.sender, helpers);
        _;
    }

    constructor(
        IGovernance _governance,
        ITokenAdminRegistry _tokenAdminRegistry,
        address _zchf,
        BridgeAccounting _bridgedAccounting
    ) {
        GOVERNANCE = _governance;
        TOKEN_ADMIN_REGISTRY = _tokenAdminRegistry;
        ZCHF = _zchf;
        BRIDGE_ACCOUNTING = _bridgedAccounting;
    }

    /**
     * @notice Sets the token pool to administer and sets in in the TokenAdminRegistry
     * @dev The token pool can only be set once
     * @param _tokenPool The token pool to set
     */
    function setTokenPool(ITokenPool _tokenPool) external {
        if (address(tokenPool) != address(0)) revert AlreadySet();
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

    function propose(bytes32 hash, uint64 delayInDays, address[] calldata _helpers) internal onlyQualified(_helpers) {
        if (proposals[hash] > 0) revert ProposalAlreadyMade(hash);
        proposals[hash] = uint64(block.timestamp) + delayInDays * DAY;
        emit ProposalMade(hash, proposals[hash]);
    }

    function deny(bytes32 hash, address[] calldata _helpers) external onlyQualified(_helpers) {
        if (proposals[hash] == 0) revert UnknownProposal(hash);
        delete proposals[hash];
        emit ProposalDenied(hash);
    }

    function enact(bytes32 hash) internal {
        uint64 deadline = proposals[hash];
        if (deadline == 0) revert UnknownProposal(hash);
        if (deadline < block.timestamp) revert TooEarly(deadline);
        delete proposals[hash];
        emit ProposalEnacted(hash);
    }

    /**
     * @notice Proposed a remote pool update
     * @dev The contract only stores the hash. So the data has to be passed in during apply again
     * @param update  The update proposal
     */
    function proposeRemotePoolUpdate(RemotePoolUpdate memory update, address[] calldata helpers) external {
        bytes32 hash = keccak256(abi.encode("remotePoolUpdate", update));
        propose(hash, 7, helpers);
        emit RemotePoolUpdateProposed(hash, msg.sender, update);
    }

    /**
     * @notice Applies the update on the TokenPool
     * @param update RemotePoolUpdate information
     */
    function applyRemotePoolUpdate(RemotePoolUpdate memory update) external {
        enact(keccak256(abi.encode("remotePoolUpdate", update)));
        if (update.add) {
            tokenPool.addRemotePool(update.chain, update.poolAddress);
            emit RemotePoolAdded(update.chain, update.poolAddress);
        } else {
            tokenPool.removeRemotePool(update.chain, update.poolAddress);
            emit RemotePoolRemoved(update.chain, update.poolAddress);
        }
    }

    /**
     * @notice Sets the rate limits for the given chain. Any qualified voter can apply rate limits with immediate effect.
     * Rate limits can only do limited harm, so it is acceptable to be very permissive. At the same time, rate limits are typically
     * applied during emergencies, e.g. when a chain has been hacked. Therefore, it is desirable to ensure that
     * they can be applied quickly. Nonetheless, the proposal fee is still charged to discourage shenenigans.
     */
    function applyRateLimit(
        uint64 chain,
        RateLimiter.Config calldata inbound,
        RateLimiter.Config calldata outbound,
        address[] calldata helpers
    ) external onlyQualified(helpers) {
        tokenPool.setChainRateLimiterConfig(chain, inbound, outbound);
        emit RateLimit(chain, inbound, outbound);
    }

    /**
     * @notice Propose to add or remove remote chains
     * @dev The contract only stores the hash. So the data has to be passed in during apply again
     * @param chainId The chain to remove
     */
    function proposeRemoveChain(uint64 chainId, address[] calldata helpers) external {
        bytes32 hash = keccak256(abi.encode("removeChain", chainId));
        propose(hash, 7, helpers);
        emit RemoveChainProposed(hash, msg.sender, chainId);
    }

    /**
     * @notice Applies the remote chain updates
     * @dev Bulk function that allows multiple updates at once
     */
    function applyRemoveChain(uint64 chainId) external {
        enact(keccak256(abi.encode("removeChain", chainId)));
        uint64[] memory chainsToRemove = new uint64[](1);
        chainsToRemove[0] = chainId;
        ITokenPool.ChainUpdate[] memory chainsToAdd = new ITokenPool.ChainUpdate[](0);
        tokenPool.applyChainUpdates(chainsToRemove, chainsToAdd);
        emit ChainRemoved(chainId);
    }

    /**
     * @notice Propose to add or remove remote chains
     * @dev The contract only stores the hash. So the data has to be passed in during apply again
     * @param config The chain configuration
     */
    function proposeAddChain(ITokenPool.ChainUpdate calldata config, address[] calldata helpers) external {
        bytes32 hash = keccak256(abi.encode("addChain", config));
        propose(hash, 7, helpers);
        emit AddChainProposed(hash, msg.sender, config);
    }

    /**
     * @notice Applies the remote chain updates
     * @dev Bulk function that allows multiple updates at once
     * @param config RemoteChainUpdate information
     */
    function applyAddChain(ITokenPool.ChainUpdate memory config) external {
        enact(keccak256(abi.encode("addChain", config)));
        uint64[] memory chainsToRemove = new uint64[](0);
        ITokenPool.ChainUpdate[] memory chainsToAdd = new ITokenPool.ChainUpdate[](1);
        chainsToAdd[0] = config;
        tokenPool.applyChainUpdates(chainsToRemove, chainsToAdd);
        emit ChainAdded(config);
    }

    /**
     * @notice Proposed a new admin for the TokenPool and Admin on the Token registry
     * @dev Useful to transfer to a new CCIPAdmin contract
     * @param _newAdmin  The address of the new admin
     */
    function proposeAdminTransfer(address _newAdmin, address[] calldata helpers) external {
        bytes32 hash = keccak256(abi.encode("adminTransfer", _newAdmin));
        propose(hash, 21, helpers);
        emit AdminTransferProposed(hash, msg.sender, _newAdmin);
    }

    /**
     * @notice Applies the admin transfer
     * @dev Transfers admin on the TokenPool and ownership on the ZCHF token on the TokenAdminRegistry
     */
    function applyAdminTransfer(address newAdmin) external {
        enact(keccak256(abi.encode("adminTransfer", newAdmin)));
        TOKEN_ADMIN_REGISTRY.transferAdminRole(ZCHF, newAdmin);
        tokenPool.transferOwnership(newAdmin);
        emit AdminTransfered(newAdmin);
    }

    function proposeAccountingSender(uint64 _chain, bytes calldata _sender, address[] calldata helpers) external {
        bytes32 hash = keccak256(abi.encode("accountingSender", _chain, _sender));
        propose(hash, 7, helpers);
        emit AccountingSenderProposed(hash, _chain, _sender);
    }

    function applyAccountSender(uint64 _chain, bytes calldata _sender) external {
        enact(keccak256(abi.encode("accountingSender", _chain, _sender)));
        BRIDGE_ACCOUNTING.addSender(_chain, _sender);
        emit AccountingSenderAdded(_chain, _sender);
    }
}
