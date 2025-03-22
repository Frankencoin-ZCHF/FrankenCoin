import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { Interface, Log } from "ethers";
import { ethers } from "hardhat";
import { evm_increaseTime } from "./helper";
import {
  CCIPAdmin,
  CCIPAdmin__factory,
  TestTokenAdminRegistry,
  TestTokenAdminRegistry__factory,
} from "../typechain";

describe("CCIP Admin Tests", () => {
  const remotePoolUpdate = {
    remoteChainSelector: 1234,
    remotePoolAddress: "0x",
    add: false,
  };
  const chainLimiterUpdate = {
    remoteChainSelectors: [1234],
    outboundConfigs: [
      {
        isEnabled: true,
        capacity: 1234,
        rate: 5678,
      },
    ],
    inboundConfigs: [
      {
        isEnabled: true,
        capacity: 1234,
        rate: 5678,
      },
    ],
  };
  const remoteChainUpdate = {
    chainsToRemove: [1234],
    chainsToAdd: [
      {
        remoteChainSelector: 1234,
        remotePoolAddresses: ["0x"],
        remoteTokenAddress: "0x",
        outboundRateLimiterConfig: {
          isEnabled: true,
          capacity: 1234,
          rate: 5678,
        },
        inboundRateLimiterConfig: {
          isEnabled: true,
          capacity: 1234,
          rate: 5678,
        },
      },
    ],
  };

  async function deployFixture() {
    const [minter, singleVoter, delegatee, delegator] =
      await ethers.getSigners();

    const frankenCoinFactory = await ethers.getContractFactory("Frankencoin");
    const zchf = await frankenCoinFactory.deploy(
      10 * 864000,
      ethers.ZeroAddress
    );
    await zchf.initialize(minter.address, "");

    const tokenPoolFactory = await ethers.getContractFactory("TestTokenPool");
    const tokenPool = await tokenPoolFactory.deploy();

    const tokenAdminRegistryFactory = await ethers.getContractFactory(
      "TestTokenAdminRegistry"
    );
    const tokenAdminRegistry = await tokenAdminRegistryFactory.deploy();

    const equity = await ethers.getContractAt("Equity", await zchf.reserve());

    const ccipAdminFactory = await ethers.getContractFactory("CCIPAdmin");
    const ccipAdmin = await ccipAdminFactory.deploy(
      await zchf.reserve(),
      await tokenAdminRegistry.getAddress(),
      3600,
      await zchf.getAddress()
    );
    await (await ccipAdmin.setTokenPool(await tokenPool.getAddress())).wait();

    // Setup users
    await zchf.mintWithReserve(
      singleVoter.address,
      ethers.parseEther("10000"),
      "10000",
      "0"
    );
    await zchf.mintWithReserve(
      delegatee.address,
      ethers.parseEther("100"),
      "1",
      "0"
    );
    await zchf.mintWithReserve(
      delegator.address,
      ethers.parseEther("10000"),
      "10000",
      "0"
    );

    await equity
      .connect(singleVoter)
      .invest(await zchf.balanceOf(singleVoter.address), 0);
    await equity
      .connect(delegatee)
      .invest(await zchf.balanceOf(delegatee.address), 0);
    await equity
      .connect(delegator)
      .invest(await zchf.balanceOf(delegator.address), 0);

    await equity.connect(delegator).delegateVoteTo(delegatee.address);
    await expect(equity.checkQualified(delegatee.address, [])).to.eventually.be
      .rejected;
    await expect(
      await equity.checkQualified(delegatee.address, [delegator.address])
    );

    return {
      minter,
      singleVoter,
      delegatee,
      delegator,
      zchf,
      tokenPool,
      tokenAdminRegistry,
      ccipAdmin,
      equity,
    };
  }

  function decodeFunctionCalledEvents(
    logs: readonly Log[],
    contractInterface: Interface
  ) {
    const decoded = [];
    for (const log of logs) {
      const parsed = contractInterface.parseLog(log);
      if (parsed && parsed.name == "FunctionCalled") {
        decoded.push(parsed);
      }
    }

    return decoded;
  }

  describe("Constructor", () => {
    it("Should set the immutables", async () => {
      const { ccipAdmin, equity, tokenAdminRegistry, zchf } = await loadFixture(
        deployFixture
      );
      expect(await ccipAdmin.GOVERNANCE()).to.be.eq(await equity.getAddress());
      expect(await ccipAdmin.VETO_PERIOD()).to.be.eq(3600);
      expect(await ccipAdmin.TOKEN_ADMIN_REGISTRY()).to.be.eq(
        await tokenAdminRegistry.getAddress()
      );
      expect(await ccipAdmin.ZCHF()).to.be.eq(await zchf.getAddress());
    });
  });

  describe("Set Token Pool", () => {
    let ccipAdmin: CCIPAdmin;
    let tokenAdminRegistry: TestTokenAdminRegistry;
    let zchfAddress: string;
    let tokenPoolAddress: string;

    beforeEach(async () => {
      const deployer = (await ethers.getSigners())[0];
      const ccipAdminFactory = new CCIPAdmin__factory(deployer);
      const tokenAdminRegistryFactory = new TestTokenAdminRegistry__factory(
        deployer
      );
      tokenAdminRegistry = await tokenAdminRegistryFactory.deploy();
      zchfAddress = ethers.getAddress(
        "0x0000000000000000000000000000000000000001"
      );
      tokenPoolAddress = ethers.getAddress(
        "0x0000000000000000000000000000000000000002"
      );

      ccipAdmin = await ccipAdminFactory.deploy(
        ethers.ZeroAddress,
        await tokenAdminRegistry.getAddress(),
        3600,
        zchfAddress
      );
    });

    it("should set the storage variable", async () => {
      await ccipAdmin.setTokenPool(tokenPoolAddress);
      expect(await ccipAdmin.tokenPool()).to.be.eq(tokenPoolAddress);
    });

    it("should only allow to set it once", async () => {
      await ccipAdmin.setTokenPool(tokenPoolAddress);
      await expect(
        ccipAdmin.setTokenPool(tokenPoolAddress)
      ).to.revertedWithCustomError(ccipAdmin, "AlreadySet");
    });

    it("should set the pool on the registry", async () => {
      const tx = await ccipAdmin.setTokenPool(tokenPoolAddress);
      const receipt = await tx.wait();

      const decodedFunctionCalls = decodeFunctionCalledEvents(
        receipt?.logs ?? [],
        tokenAdminRegistry.interface
      );
      let found = 0;
      const functionArgs = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address"],
        [zchfAddress, tokenPoolAddress]
      );
      for (const functionCall of decodedFunctionCalls) {
        if (
          functionCall.args[0] == "setPool" &&
          functionCall.args[1] == functionArgs
        ) {
          found++;
        }
      }
    });
  });

  describe("Accept Admin", () => {
    it("should call acceptAdminRole", async () => {
      const { ccipAdmin, tokenAdminRegistry, zchf } = await loadFixture(
        deployFixture
      );

      const tx = await ccipAdmin.acceptAdmin();
      const receipt = await tx.wait();

      const decodedFunctionCalls = decodeFunctionCalledEvents(
        receipt?.logs ?? [],
        tokenAdminRegistry.interface
      );
      let found = 0;
      const functionArgs = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"],
        [await zchf.getAddress()]
      );
      for (const functionCall of decodedFunctionCalls) {
        if (
          functionCall.args[0] == "acceptAdminRole" &&
          functionCall.args[1] == functionArgs
        ) {
          found++;
        }
      }
    });
  });

  describe("Accept Ownership", () => {
    it("should call acceptOwnership", async () => {
      const { ccipAdmin, tokenPool } = await loadFixture(deployFixture);

      const tx = await ccipAdmin.acceptAdmin();
      const receipt = await tx.wait();

      const decodedFunctionCalls = decodeFunctionCalledEvents(
        receipt?.logs ?? [],
        tokenPool.interface
      );
      let found = 0;
      const functionArgs = ethers.AbiCoder.defaultAbiCoder().encode([], []);
      for (const functionCall of decodedFunctionCalls) {
        if (
          functionCall.args[0] == "acceptOwnership" &&
          functionCall.args[1] == functionArgs
        ) {
          found++;
        }
      }
    });
  });

  describe("accept ownership and admin", () => {
    it("should call acceptAdminRole", async () => {
      const { ccipAdmin, tokenAdminRegistry, zchf } = await loadFixture(
        deployFixture
      );

      const tx = await ccipAdmin.acceptCCIPAll();
      const receipt = await tx.wait();

      const decodedFunctionCalls = decodeFunctionCalledEvents(
        receipt?.logs ?? [],
        tokenAdminRegistry.interface
      );
      let found = 0;
      const functionArgs = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"],
        [await zchf.getAddress()]
      );
      for (const functionCall of decodedFunctionCalls) {
        if (
          functionCall.args[0] == "acceptAdminRole" &&
          functionCall.args[1] == functionArgs
        ) {
          found++;
        }
      }
    });

    it("should call acceptOwnership", async () => {
      const { ccipAdmin, tokenPool } = await loadFixture(deployFixture);

      const tx = await ccipAdmin.acceptCCIPAll();
      const receipt = await tx.wait();

      const decodedFunctionCalls = decodeFunctionCalledEvents(
        receipt?.logs ?? [],
        tokenPool.interface
      );
      let found = 0;
      const functionArgs = ethers.AbiCoder.defaultAbiCoder().encode([], []);
      for (const functionCall of decodedFunctionCalls) {
        if (
          functionCall.args[0] == "acceptOwnership" &&
          functionCall.args[1] == functionArgs
        ) {
          found++;
        }
      }
    });
  });

  describe("Propose Remote Pool Update", async () => {
    const updateTypes =
      "(uint64 remoteChainSelector, bytes remotePoolAddress, bool add)";

    it("should allow to propose", async () => {
      const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
      const expectedHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          [updateTypes],
          [remotePoolUpdate]
        )
      );
      const tx = await ccipAdmin
        .connect(singleVoter)
        .proposeRemotePoolUpdate(remotePoolUpdate, []);
      const block = await tx.getBlock();

      expect(await ccipAdmin.proposedRemotePoolUpdate()).to.equal(expectedHash);
      expect(await ccipAdmin.remotePoolUpdateDeadline()).to.equal(
        BigInt(block?.timestamp ?? 0) + (await ccipAdmin.VETO_PERIOD())
      );
    });

    it("should only allow qualified voters", async () => {
      const { ccipAdmin, delegatee, equity } = await loadFixture(deployFixture);
      await expect(
        ccipAdmin
          .connect(delegatee)
          .proposeRemotePoolUpdate(remotePoolUpdate, [])
      ).revertedWithCustomError(equity, "NotQualified");
    });

    it("should forward helpers", async () => {
      const { ccipAdmin, delegatee, delegator } = await loadFixture(
        deployFixture
      );
      await ccipAdmin
        .connect(delegatee)
        .proposeRemotePoolUpdate(remotePoolUpdate, [delegator.address]);
    });

    it("should allow to overwrite a proposal", async () => {
      const { ccipAdmin, delegatee, delegator } = await loadFixture(
        deployFixture
      );
      await ccipAdmin
        .connect(delegatee)
        .proposeRemotePoolUpdate(remotePoolUpdate, [delegator.address]);

      const newUpdate = { ...remotePoolUpdate };
      newUpdate.add = !newUpdate.add;
      const expectedHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode([updateTypes], [newUpdate])
      );

      await ccipAdmin
        .connect(delegatee)
        .proposeRemotePoolUpdate(newUpdate, [delegator.address]);
      expect(await ccipAdmin.proposedRemotePoolUpdate()).to.eq(expectedHash);
    });
  });

  describe("Propose Ratelimit update", async () => {
    const updateTypes =
      "(uint64[] remoteChainSelectors, (bool isEnabled, uint128 capacity, uint128 rate)[] outboundConfigs, (bool isEnabled, uint128 capacity, uint128 rate)[] inboundConfigs)";

    it("should allow to propose", async () => {
      const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
      const expectedHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          [updateTypes],
          [chainLimiterUpdate]
        )
      );
      const tx = await ccipAdmin
        .connect(singleVoter)
        .proposeChainRateLimiterUpdate(chainLimiterUpdate, []);
      const block = await tx.getBlock();

      expect(await ccipAdmin.proposedChainRateLimiterUpdate()).to.equal(
        expectedHash
      );
      expect(await ccipAdmin.chainRateLimiterDeadline()).to.equal(
        BigInt(block?.timestamp ?? 0) + (await ccipAdmin.VETO_PERIOD())
      );
    });

    it("should only allow qualified voters", async () => {
      const { ccipAdmin, delegatee, equity } = await loadFixture(deployFixture);
      await expect(
        ccipAdmin
          .connect(delegatee)
          .proposeChainRateLimiterUpdate(chainLimiterUpdate, [])
      ).revertedWithCustomError(equity, "NotQualified");
    });

    it("should forward helpers", async () => {
      const { ccipAdmin, delegatee, delegator } = await loadFixture(
        deployFixture
      );
      await ccipAdmin
        .connect(delegatee)
        .proposeChainRateLimiterUpdate(chainLimiterUpdate, [delegator.address]);
    });

    it("should allow to overwrite a proposal", async () => {
      const { ccipAdmin, delegatee, delegator } = await loadFixture(
        deployFixture
      );
      await ccipAdmin
        .connect(delegatee)
        .proposeChainRateLimiterUpdate(chainLimiterUpdate, [delegator.address]);

      const newUpdate = { ...chainLimiterUpdate };
      newUpdate.remoteChainSelectors.push(5678);
      const expectedHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode([updateTypes], [newUpdate])
      );

      await ccipAdmin
        .connect(delegatee)
        .proposeChainRateLimiterUpdate(newUpdate, [delegator.address]);
      expect(await ccipAdmin.proposedChainRateLimiterUpdate()).to.eq(
        expectedHash
      );
    });
  });

  describe("Propose Remote Chain Update", async () => {
    const updateTypes =
      "(uint64[] chainsToRemove, (uint64 remoteChainSelector, bytes[] remotePoolAddresses, bytes remoteTokenAddress, (bool isEnabled, uint128 capacity, uint128 rate) outboundRateLimiterConfig, (bool isEnabled, uint128 capacity, uint128 rate) inboundRateLimiterConfig)[] chainsToAdd)";

    it("should allow to propose", async () => {
      const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
      const expectedHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          [updateTypes],
          [remoteChainUpdate]
        )
      );
      const tx = await ccipAdmin
        .connect(singleVoter)
        .proposeRemoteChainUpdate(remoteChainUpdate, []);
      const block = await tx.getBlock();

      expect(await ccipAdmin.proposedRemoteChainUpdate()).to.equal(
        expectedHash
      );
      expect(await ccipAdmin.remoteChainDeadline()).to.equal(
        BigInt(block?.timestamp ?? 0) + (await ccipAdmin.VETO_PERIOD())
      );
    });

    it("should only allow qualified voters", async () => {
      const { ccipAdmin, delegatee, equity } = await loadFixture(deployFixture);
      await expect(
        ccipAdmin
          .connect(delegatee)
          .proposeRemoteChainUpdate(remoteChainUpdate, [])
      ).revertedWithCustomError(equity, "NotQualified");
    });

    it("should forward helpers", async () => {
      const { ccipAdmin, delegatee, delegator } = await loadFixture(
        deployFixture
      );
      await ccipAdmin
        .connect(delegatee)
        .proposeRemoteChainUpdate(remoteChainUpdate, [delegator.address]);
    });

    it("should allow to overwrite a proposal", async () => {
      const { ccipAdmin, delegatee, delegator } = await loadFixture(
        deployFixture
      );
      await ccipAdmin
        .connect(delegatee)
        .proposeRemoteChainUpdate(remoteChainUpdate, [delegator.address]);

      const newUpdate = { ...remoteChainUpdate };
      newUpdate.chainsToRemove.push(11111);
      const expectedHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode([updateTypes], [newUpdate])
      );

      await ccipAdmin
        .connect(delegatee)
        .proposeRemoteChainUpdate(newUpdate, [delegator.address]);
      expect(await ccipAdmin.proposedRemoteChainUpdate()).to.eq(expectedHash);
    });
  });

  describe("Propose Admin Transfer", async () => {
    it("should allow to propose", async () => {
      const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
      const tx = await ccipAdmin
        .connect(singleVoter)
        .proposeAdminTransfer(singleVoter.address, []);
      const block = await tx.getBlock();

      expect(await ccipAdmin.proposedAdmin()).to.equal(singleVoter.address);
      expect(await ccipAdmin.adminDeadline()).to.equal(
        BigInt(block?.timestamp ?? 0) + (await ccipAdmin.VETO_PERIOD())
      );
    });

    it("should only allow qualified voters", async () => {
      const { ccipAdmin, delegatee, equity } = await loadFixture(deployFixture);
      await expect(
        ccipAdmin.connect(delegatee).proposeAdminTransfer(delegatee.address, [])
      ).revertedWithCustomError(equity, "NotQualified");
    });

    it("should forward helpers", async () => {
      const { ccipAdmin, delegatee, delegator } = await loadFixture(
        deployFixture
      );
      await ccipAdmin
        .connect(delegatee)
        .proposeAdminTransfer(delegatee.address, [delegator.address]);
    });

    it("should allow to overwrite a proposal", async () => {
      const { ccipAdmin, delegatee, delegator } = await loadFixture(
        deployFixture
      );
      await ccipAdmin
        .connect(delegatee)
        .proposeAdminTransfer(delegatee.address, [delegator.address]);

      await ccipAdmin
        .connect(delegatee)
        .proposeAdminTransfer(delegator.address, [delegator.address]);
      expect(await ccipAdmin.proposedAdmin()).to.eq(delegator.address);
    });
  });

  describe("Veto Proposal", async () => {
    it("should only allow qualified", async () => {
      const { ccipAdmin, delegatee, equity } = await loadFixture(deployFixture);

      await expect(
        ccipAdmin.connect(delegatee).vetoProposal(0, [])
      ).revertedWithCustomError(equity, "NotQualified");
    });

    it("should forward helpers", async () => {
      const { ccipAdmin, delegatee, delegator } = await loadFixture(
        deployFixture
      );

      await ccipAdmin.connect(delegatee).vetoProposal(0, [delegator.address]);
    });

    it("should veto remote pool update", async () => {
      const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);

      await ccipAdmin
        .connect(singleVoter)
        .proposeRemotePoolUpdate(remotePoolUpdate, []);
      expect(await ccipAdmin.remotePoolUpdateDeadline()).to.greaterThan(0);

      await ccipAdmin.connect(singleVoter).vetoProposal(0, []);
      expect(await ccipAdmin.remotePoolUpdateDeadline()).to.equal(0);
    });

    it("should veto chain limiter update", async () => {
      const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);

      await ccipAdmin
        .connect(singleVoter)
        .proposeChainRateLimiterUpdate(chainLimiterUpdate, []);
      expect(await ccipAdmin.chainRateLimiterDeadline()).to.greaterThan(0);

      await ccipAdmin.connect(singleVoter).vetoProposal(1, []);
      expect(await ccipAdmin.chainRateLimiterDeadline()).to.equal(0);
    });

    it("should veto remote chain update", async () => {
      const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);

      await ccipAdmin
        .connect(singleVoter)
        .proposeRemoteChainUpdate(remoteChainUpdate, []);
      expect(await ccipAdmin.remoteChainDeadline()).to.greaterThan(0);

      await ccipAdmin.connect(singleVoter).vetoProposal(2, []);
      expect(await ccipAdmin.remoteChainDeadline()).to.equal(0);
    });

    it("should veto admin transfer update", async () => {
      const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);

      await ccipAdmin
        .connect(singleVoter)
        .proposeAdminTransfer(singleVoter.address, []);
      expect(await ccipAdmin.adminDeadline()).to.greaterThan(0);

      await ccipAdmin.connect(singleVoter).vetoProposal(3, []);
      expect(await ccipAdmin.adminDeadline()).to.equal(0);
    });
  });

  describe("Apply Proposal", () => {
    describe("Remote Pool Update", () => {
      it("should check if appliable (no proposal)", async () => {
        const { ccipAdmin } = await loadFixture(deployFixture);
        await expect(
          ccipAdmin.applyProposal(0, "0x")
        ).to.revertedWithCustomError(ccipAdmin, "NotAppliable");
      });
      it("should check if appliable (deadline)", async () => {
        const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
        await ccipAdmin
          .connect(singleVoter)
          .proposeRemotePoolUpdate(remotePoolUpdate, []);
        await expect(
          ccipAdmin.applyProposal(0, "0x")
        ).to.revertedWithCustomError(ccipAdmin, "NotAppliable");
      });

      it("should check the data", async () => {
        const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
        await ccipAdmin
          .connect(singleVoter)
          .proposeRemotePoolUpdate(remotePoolUpdate, []);
        await evm_increaseTime(await ccipAdmin.VETO_PERIOD());
        await expect(
          ccipAdmin.applyProposal(0, "0x")
        ).to.revertedWithCustomError(ccipAdmin, "InvalidUpdate");
      });

      it("should call addRemotePool", async () => {
        const { ccipAdmin, singleVoter, tokenPool } = await loadFixture(
          deployFixture
        );
        const update = { ...remotePoolUpdate };
        update.add = true;
        await ccipAdmin
          .connect(singleVoter)
          .proposeRemotePoolUpdate(update, []);
        await evm_increaseTime(await ccipAdmin.VETO_PERIOD());
        const data = ethers.AbiCoder.defaultAbiCoder().encode(
          ["(uint64 remoteChainSelector, bytes remotePoolAddress, bool add)"],
          [update]
        );
        const tx = await ccipAdmin.applyProposal(0, data);
        const receipt = await tx.wait();
        const decodedFunctionCalls = decodeFunctionCalledEvents(
          receipt?.logs ?? [],
          tokenPool.interface
        );
        let found = 0;
        const functionArgs = ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint64", "bytes"],
          [
            remotePoolUpdate.remoteChainSelector,
            remotePoolUpdate.remotePoolAddress,
          ]
        );
        for (const functionCall of decodedFunctionCalls) {
          if (
            functionCall.args[0] == "addRemotePool" &&
            functionCall.args[1] == functionArgs
          ) {
            found++;
          }
        }

        expect(found).to.eq(1);
      });

      it("should call removeRemotePool", async () => {
        const { ccipAdmin, singleVoter, tokenPool } = await loadFixture(
          deployFixture
        );
        await ccipAdmin
          .connect(singleVoter)
          .proposeRemotePoolUpdate(remotePoolUpdate, []);
        await evm_increaseTime(await ccipAdmin.VETO_PERIOD());
        const data = ethers.AbiCoder.defaultAbiCoder().encode(
          ["(uint64 remoteChainSelector, bytes remotePoolAddress, bool add)"],
          [remotePoolUpdate]
        );
        const tx = await ccipAdmin.applyProposal(0, data);
        const receipt = await tx.wait();
        const decodedFunctionCalls = decodeFunctionCalledEvents(
          receipt?.logs ?? [],
          tokenPool.interface
        );
        let found = 0;
        const functionArgs = ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint64", "bytes"],
          [
            remotePoolUpdate.remoteChainSelector,
            remotePoolUpdate.remotePoolAddress,
          ]
        );
        for (const functionCall of decodedFunctionCalls) {
          if (
            functionCall.args[0] == "removeRemotePool" &&
            functionCall.args[1] == functionArgs
          ) {
            found++;
          }
        }

        expect(found).to.eq(1);
      });

      it("should reset the deadline", async () => {
        const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
        const data = ethers.AbiCoder.defaultAbiCoder().encode(
          ["(uint64 remoteChainSelector, bytes remotePoolAddress, bool add)"],
          [remotePoolUpdate]
        );

        await ccipAdmin
          .connect(singleVoter)
          .proposeRemotePoolUpdate(remotePoolUpdate, []);
        expect(await ccipAdmin.remotePoolUpdateDeadline()).to.be.greaterThan(0);
        await evm_increaseTime(await ccipAdmin.VETO_PERIOD());
        await ccipAdmin.applyProposal(0, data);
        expect(await ccipAdmin.remotePoolUpdateDeadline()).to.be.equal(0);
      });
    });

    describe("Chain Ratelimit Update", () => {
      it("should check if appliable (no proposal)", async () => {
        const { ccipAdmin } = await loadFixture(deployFixture);
        await expect(
          ccipAdmin.applyProposal(1, "0x")
        ).to.revertedWithCustomError(ccipAdmin, "NotAppliable");
      });
      it("should check if appliable (deadline)", async () => {
        const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
        await ccipAdmin
          .connect(singleVoter)
          .proposeChainRateLimiterUpdate(chainLimiterUpdate, []);
        await expect(
          ccipAdmin.applyProposal(1, "0x")
        ).to.revertedWithCustomError(ccipAdmin, "NotAppliable");
      });

      it("should check the data", async () => {
        const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
        await ccipAdmin
          .connect(singleVoter)
          .proposeChainRateLimiterUpdate(chainLimiterUpdate, []);
        await evm_increaseTime(await ccipAdmin.VETO_PERIOD());
        await expect(
          ccipAdmin.applyProposal(1, "0x")
        ).to.revertedWithCustomError(ccipAdmin, "InvalidUpdate");
      });

      it("should call setChainRateLimiterConfigs", async () => {
        const { ccipAdmin, singleVoter, tokenPool } = await loadFixture(
          deployFixture
        );

        await ccipAdmin
          .connect(singleVoter)
          .proposeChainRateLimiterUpdate(chainLimiterUpdate, []);
        await evm_increaseTime(await ccipAdmin.VETO_PERIOD());
        const data = ethers.AbiCoder.defaultAbiCoder().encode(
          [
            "(uint64[] remoteChainSelectors, (bool isEnabled, uint128 capacity, uint128 rate)[] outboundConfigs, (bool isEnabled, uint128 capacity, uint128 rate)[] inboundConfigs)",
          ],
          [chainLimiterUpdate]
        );
        const tx = await ccipAdmin.applyProposal(1, data);
        const receipt = await tx.wait();
        const decodedFunctionCalls = decodeFunctionCalledEvents(
          receipt?.logs ?? [],
          tokenPool.interface
        );
        let found = 0;
        const functionArgs = ethers.AbiCoder.defaultAbiCoder().encode(
          [
            "uint64[] remoteChainSelectors",
            "(bool isEnabled, uint128 capacity, uint128 rate)[]",
            "(bool isEnabled, uint128 capacity, uint128 rate)[]",
          ],
          [
            chainLimiterUpdate.remoteChainSelectors,
            chainLimiterUpdate.outboundConfigs,
            chainLimiterUpdate.inboundConfigs,
          ]
        );
        for (const functionCall of decodedFunctionCalls) {
          if (
            functionCall.args[0] == "setChainRateLimiterConfigs" &&
            functionCall.args[1] == functionArgs
          ) {
            found++;
          }
        }

        expect(found).to.eq(1);
      });

      it("should reset the deadline", async () => {
        const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
        const data = ethers.AbiCoder.defaultAbiCoder().encode(
          [
            "(uint64[] remoteChainSelectors, (bool isEnabled, uint128 capacity, uint128 rate)[] outboundConfigs, (bool isEnabled, uint128 capacity, uint128 rate)[] inboundConfigs)",
          ],
          [chainLimiterUpdate]
        );

        await ccipAdmin
          .connect(singleVoter)
          .proposeChainRateLimiterUpdate(chainLimiterUpdate, []);
        expect(await ccipAdmin.chainRateLimiterDeadline()).to.be.greaterThan(0);
        await evm_increaseTime(await ccipAdmin.VETO_PERIOD());
        await ccipAdmin.applyProposal(1, data);
        expect(await ccipAdmin.chainRateLimiterDeadline()).to.be.equal(0);
      });
    });
    describe("Remote Chains Update", () => {
      it("should check if appliable (no proposal)", async () => {
        const { ccipAdmin } = await loadFixture(deployFixture);
        await expect(
          ccipAdmin.applyProposal(2, "0x")
        ).to.revertedWithCustomError(ccipAdmin, "NotAppliable");
      });
      it("should check if appliable (deadline)", async () => {
        const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
        await ccipAdmin
          .connect(singleVoter)
          .proposeRemoteChainUpdate(remoteChainUpdate, []);
        await expect(
          ccipAdmin.applyProposal(2, "0x")
        ).to.revertedWithCustomError(ccipAdmin, "NotAppliable");
      });

      it("should check the data", async () => {
        const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
        await ccipAdmin
          .connect(singleVoter)
          .proposeRemoteChainUpdate(remoteChainUpdate, []);
        await evm_increaseTime(await ccipAdmin.VETO_PERIOD());
        await expect(
          ccipAdmin.applyProposal(2, "0x")
        ).to.revertedWithCustomError(ccipAdmin, "InvalidUpdate");
      });

      it("should call applyChainUpdates", async () => {
        const { ccipAdmin, singleVoter, tokenPool } = await loadFixture(
          deployFixture
        );

        await ccipAdmin
          .connect(singleVoter)
          .proposeRemoteChainUpdate(remoteChainUpdate, []);
        await evm_increaseTime(await ccipAdmin.VETO_PERIOD());
        const data = ethers.AbiCoder.defaultAbiCoder().encode(
          [
            "(uint64[] chainsToRemove, (uint64 remoteChainSelector, bytes[] remotePoolAddresses, bytes remoteTokenAddress, (bool isEnabled, uint128 capacity, uint128 rate) outboundRateLimiterConfig, (bool isEnabled, uint128 capacity, uint128 rate) inboundRateLimiterConfig)[] chainsToAdd)",
          ],
          [remoteChainUpdate]
        );
        const tx = await ccipAdmin.applyProposal(2, data);
        const receipt = await tx.wait();
        const decodedFunctionCalls = decodeFunctionCalledEvents(
          receipt?.logs ?? [],
          tokenPool.interface
        );
        let found = 0;
        const functionArgs = ethers.AbiCoder.defaultAbiCoder().encode(
          [
            "uint64[] chainsToRemove",
            "(uint64 remoteChainSelector, bytes[] remotePoolAddresses, bytes remoteTokenAddress, (bool isEnabled, uint128 capacity, uint128 rate) outboundRateLimiterConfig, (bool isEnabled, uint128 capacity, uint128 rate) inboundRateLimiterConfig)[] chainsToAdd",
          ],
          [remoteChainUpdate.chainsToRemove, remoteChainUpdate.chainsToAdd]
        );
        for (const functionCall of decodedFunctionCalls) {
          if (
            functionCall.args[0] == "applyChainUpdates" &&
            functionCall.args[1] == functionArgs
          ) {
            found++;
          }
        }

        expect(found).to.eq(1);
      });

      it("should reset the deadline", async () => {
        const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
        const data = ethers.AbiCoder.defaultAbiCoder().encode(
          [
            "(uint64[] chainsToRemove, (uint64 remoteChainSelector, bytes[] remotePoolAddresses, bytes remoteTokenAddress, (bool isEnabled, uint128 capacity, uint128 rate) outboundRateLimiterConfig, (bool isEnabled, uint128 capacity, uint128 rate) inboundRateLimiterConfig)[] chainsToAdd)",
          ],
          [remoteChainUpdate]
        );

        await ccipAdmin
          .connect(singleVoter)
          .proposeRemoteChainUpdate(remoteChainUpdate, []);
        expect(await ccipAdmin.remoteChainDeadline()).to.be.greaterThan(0);
        await evm_increaseTime(await ccipAdmin.VETO_PERIOD());
        await ccipAdmin.applyProposal(2, data);
        expect(await ccipAdmin.remoteChainDeadline()).to.be.equal(0);
      });
    });

    describe("Admin Transfer", () => {
      it("should check if appliable (no proposal)", async () => {
        const { ccipAdmin } = await loadFixture(deployFixture);
        await expect(
          ccipAdmin.applyProposal(3, "0x")
        ).to.revertedWithCustomError(ccipAdmin, "NotAppliable");
      });
      it("should check if appliable (deadline)", async () => {
        const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
        await ccipAdmin
          .connect(singleVoter)
          .proposeRemoteChainUpdate(remoteChainUpdate, []);
        await expect(
          ccipAdmin.applyProposal(3, "0x")
        ).to.revertedWithCustomError(ccipAdmin, "NotAppliable");
      });

      it("should call transferAdminRole", async () => {
        const { ccipAdmin, singleVoter, tokenAdminRegistry, zchf } =
          await loadFixture(deployFixture);

        await ccipAdmin
          .connect(singleVoter)
          .proposeAdminTransfer(singleVoter.address, []);
        await evm_increaseTime(await ccipAdmin.VETO_PERIOD());

        const tx = await ccipAdmin.applyProposal(3, "0x");
        const receipt = await tx.wait();
        const decodedFunctionCalls = decodeFunctionCalledEvents(
          receipt?.logs ?? [],
          tokenAdminRegistry.interface
        );
        let found = 0;
        const functionArgs = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "address"],
          [await zchf.getAddress(), singleVoter.address]
        );
        for (const functionCall of decodedFunctionCalls) {
          if (
            functionCall.args[0] == "transferAdminRole" &&
            functionCall.args[1] == functionArgs
          ) {
            found++;
          }
        }

        expect(found).to.eq(1);
      });

      it("should call transferOwnership", async () => {
        const { ccipAdmin, singleVoter, tokenPool } = await loadFixture(
          deployFixture
        );

        await ccipAdmin
          .connect(singleVoter)
          .proposeAdminTransfer(singleVoter.address, []);
        await evm_increaseTime(await ccipAdmin.VETO_PERIOD());

        const tx = await ccipAdmin.applyProposal(3, "0x");
        const receipt = await tx.wait();
        const decodedFunctionCalls = decodeFunctionCalledEvents(
          receipt?.logs ?? [],
          tokenPool.interface
        );
        let found = 0;
        const functionArgs = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address"],
          [singleVoter.address]
        );
        for (const functionCall of decodedFunctionCalls) {
          if (
            functionCall.args[0] == "transferOwnership" &&
            functionCall.args[1] == functionArgs
          ) {
            found++;
          }
        }

        expect(found).to.eq(1);
      });

      it("should reset the deadline", async () => {
        const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
        await ccipAdmin
          .connect(singleVoter)
          .proposeAdminTransfer(singleVoter.address, []);
        expect(await ccipAdmin.adminDeadline()).to.be.greaterThan(0);
        await evm_increaseTime(await ccipAdmin.VETO_PERIOD());
        await ccipAdmin.applyProposal(3, "0x");
        expect(await ccipAdmin.adminDeadline()).to.be.equal(0);
      });
    });
  });
});
