import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { Interface, Log } from "ethers";
import { ethers } from "hardhat";
import { evm_increaseTime } from "./helper";

describe.only("CCIP Admin Tests", () => {
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
    const zchf = await frankenCoinFactory.deploy(10 * 864000);
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
      await tokenPool.getAddress(),
      await tokenAdminRegistry.getAddress(),
      3600,
      await zchf.getAddress()
    );

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

  describe("constructor", () => {
    it("should accept the admin role on the registry", async () => {
      const { ccipAdmin, tokenAdminRegistry, zchf } = await loadFixture(
        deployFixture
      );
      const deployTx = await ccipAdmin
        .deploymentTransaction()
        ?.getTransaction();
      const receipt = await deployTx?.wait();

      const decodedFunctionCalls = decodeFunctionCalledEvents(
        receipt?.logs ?? [],
        tokenAdminRegistry.interface
      );

      let found = false;
      for (const functionCall of decodedFunctionCalls) {
        if (functionCall.args[0] == "acceptAdminRole") {
          const functionArgs = ethers.AbiCoder.defaultAbiCoder().decode(
            ["address"],
            functionCall.args[1]
          );
          if (functionArgs[0] == (await zchf.getAddress())) {
            found = true;
          }
        }
      }

      expect(found).to.true;
    });

    it("should set the pool", async () => {
      const { ccipAdmin, tokenAdminRegistry, zchf, tokenPool } =
        await loadFixture(deployFixture);
      const deployTx = await ccipAdmin
        .deploymentTransaction()
        ?.getTransaction();
      const receipt = await deployTx?.wait();

      const decodedFunctionCalls = decodeFunctionCalledEvents(
        receipt?.logs ?? [],
        tokenAdminRegistry.interface
      );

      let found = false;
      for (const functionCall of decodedFunctionCalls) {
        if (functionCall.args[0] == "setPool") {
          const functionArgs = ethers.AbiCoder.defaultAbiCoder().decode(
            ["address", "address"],
            functionCall.args[1]
          );
          if (
            functionArgs[0] == (await zchf.getAddress()) &&
            functionArgs[1] == (await tokenPool.getAddress())
          ) {
            found = true;
          }
        }
      }

      expect(found).to.true;
    });

    it("should accept the ownership", async () => {
      const { ccipAdmin, tokenPool } = await loadFixture(deployFixture);
      const deployTx = await ccipAdmin
        .deploymentTransaction()
        ?.getTransaction();
      const receipt = await deployTx?.wait();

      const decodedFunctionCalls = decodeFunctionCalledEvents(
        receipt?.logs ?? [],
        tokenPool.interface
      );

      let found = false;
      for (const functionCall of decodedFunctionCalls) {
        if (functionCall.args[0] == "acceptOwnership") {
          found = true;
        }
      }

      expect(found).to.true;
    });
  });

  describe("propose remote pool update", async () => {
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

      const newUpdate = {...remotePoolUpdate};
      newUpdate.add = !newUpdate.add;
      const expectedHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          [updateTypes],
          [newUpdate]
        )
      );

      await ccipAdmin
        .connect(delegatee)
        .proposeRemotePoolUpdate(newUpdate, [delegator.address]);
      expect(await ccipAdmin.proposedRemotePoolUpdate()).to.eq(expectedHash);
    });
  });

  describe("propose chain rate limiter update", async () => {
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

      const newUpdate = {...chainLimiterUpdate};
      newUpdate.remoteChainSelectors.push(5678)
      const expectedHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          [updateTypes],
          [newUpdate]
        )
      );

      await ccipAdmin
        .connect(delegatee)
        .proposeChainRateLimiterUpdate(newUpdate, [delegator.address]);
      expect(await ccipAdmin.proposedChainRateLimiterUpdate()).to.eq(expectedHash);
    });
  });

  describe("propose remote chain update", async () => {
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

      const newUpdate = {...remoteChainUpdate};
      newUpdate.chainsToRemove.push(11111)
      const expectedHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          [updateTypes],
          [newUpdate]
        )
      );

      await ccipAdmin
        .connect(delegatee)
        .proposeRemoteChainUpdate(newUpdate, [delegator.address]);
      expect(await ccipAdmin.proposedRemoteChainUpdate()).to.eq(expectedHash);
    });
  });

  describe("propose admin transfer", async () => {
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

  describe("veto proposal", async () => {
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
});
