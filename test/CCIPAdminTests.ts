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
    chain: 1234,
    poolAddress: "0x",
    add: false,
  };
  const chainLimiterUpdate = {
    chain: [1234],
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
      await tokenAdminRegistry.getAddress(),
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
    logs: Log[],
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

  describe("setTokenPool", () => {
    it("should set the token pool", async () => {
      const { zchf, tokenAdminRegistry, tokenPool } = await loadFixture(
        deployFixture
      );
      const ccipAdminFactory = await ethers.getContractFactory("CCIPAdmin");
      const ccipAdmin = await ccipAdminFactory.deploy(
        await zchf.reserve(),
        await tokenAdminRegistry.getAddress(),
        await zchf.getAddress()
      );

      await ccipAdmin.setTokenPool(await tokenPool.getAddress());
      expect(await ccipAdmin.tokenPool()).to.equal(
        await tokenPool.getAddress()
      );
    });

    it("should revert if already set", async () => {
      const { zchf, tokenAdminRegistry, tokenPool } = await loadFixture(
        deployFixture
      );
      const ccipAdminFactory = await ethers.getContractFactory("CCIPAdmin");
      const ccipAdmin = await ccipAdminFactory.deploy(
        await zchf.reserve(),
        await tokenAdminRegistry.getAddress(),
        await zchf.getAddress()
      );

      await ccipAdmin.setTokenPool(await tokenPool.getAddress());
      await expect(
        ccipAdmin.setTokenPool(await tokenPool.getAddress())
      ).to.be.revertedWithCustomError(ccipAdmin, "AlreadySet");
    });

    it("should call the tokenAdminRegistry", async () => {
      const { zchf, tokenAdminRegistry, tokenPool } = await loadFixture(
        deployFixture
      );
      const ccipAdminFactory = await ethers.getContractFactory("CCIPAdmin");
      const ccipAdmin = await ccipAdminFactory.deploy(
        await zchf.reserve(),
        await tokenAdminRegistry.getAddress(),
        await zchf.getAddress()
      );

      const tx = await ccipAdmin.setTokenPool(await tokenPool.getAddress());
      const receipt = await tx.wait();
      const decoded = decodeFunctionCalledEvents(
        receipt?.logs ?? [],
        tokenAdminRegistry.interface
      );
      expect(decoded.length).to.equal(1);
      expect(decoded[0].args.name).to.equal("setPool");
    });
  });

  describe("acceptAdmin", () => {
    it("should accept admin", async () => {
      const { tokenAdminRegistry, ccipAdmin } = await loadFixture(
        deployFixture
      );

      const tx = await ccipAdmin.acceptAdmin();
      const receipt = await tx.wait();
      const decoded = decodeFunctionCalledEvents(
        receipt?.logs ?? [],
        tokenAdminRegistry.interface
      );
      expect(decoded.length).to.equal(1);
      expect(decoded[0].args.name).to.equal("acceptAdminRole");
    });
  });

  describe("acceptOwnership", () => {
    it("should accept ownership", async () => {
      const { tokenPool, ccipAdmin } = await loadFixture(deployFixture);
      const tx = await ccipAdmin.acceptOwnership();
      const receipt = await tx.wait();
      const decoded = decodeFunctionCalledEvents(
        receipt?.logs ?? [],
        tokenPool.interface
      );
      expect(decoded.length).to.equal(1);
      expect(decoded[0].args.name).to.equal("acceptOwnership");
    });
  });

  describe("deny", () => {
    const hash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "uint64"],
        ["removeChain", ethers.ZeroAddress]
      )
    );

    it("should deny", async () => {
      const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
      await ccipAdmin
        .connect(singleVoter)
        .proposeRemoveChain(ethers.ZeroAddress, []);
      expect(await ccipAdmin.proposals(hash)).to.be.greaterThan(0);
      await expect(ccipAdmin.connect(singleVoter).deny(hash, [])).to.emit(
        ccipAdmin,
        "ProposalDenied"
      );
      expect(await ccipAdmin.proposals(hash)).to.equal(0);
    });

    it("should revert if proposal is unknown", async () => {
      const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
      await expect(
        ccipAdmin.connect(singleVoter).deny(hash, [])
      ).to.revertedWithCustomError(ccipAdmin, "UnknownProposal");
    });

    it("should forward helpers", async () => {
      const { ccipAdmin, delegatee, delegator } = await loadFixture(
        deployFixture
      );
      await expect(
        ccipAdmin.connect(delegatee).deny(hash, [delegator.address])
      ).to.revertedWithCustomError(ccipAdmin, "UnknownProposal");
    });

    it("should revert if not qualified", async () => {
      const { ccipAdmin, equity } = await loadFixture(deployFixture);
      await expect(ccipAdmin.deny(hash, [])).to.revertedWithCustomError(
        equity,
        "NotQualified"
      );
    });
  });

  describe("proposeRemotePoolUpdate", () => {
    const hash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "(bool add,uint64 chain,bytes poolAddress)"],
        ["remotePoolUpdate", remotePoolUpdate]
      )
    );

    it("should propose", async () => {
      const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
      await ccipAdmin
        .connect(singleVoter)
        .proposeRemotePoolUpdate(remotePoolUpdate, []);
      expect(await ccipAdmin.proposals(hash)).to.be.greaterThan(0);
    });

    it("should revert if already proposed", async () => {
      const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
      await ccipAdmin
        .connect(singleVoter)
        .proposeRemotePoolUpdate(remotePoolUpdate, []);
      await expect(
        ccipAdmin
          .connect(singleVoter)
          .proposeRemotePoolUpdate(remotePoolUpdate, [])
      ).to.revertedWithCustomError(ccipAdmin, "ProposalAlreadyMade");
    });

    it("should forward helpers", async () => {
      const { ccipAdmin, delegatee, delegator } = await loadFixture(
        deployFixture
      );
      await ccipAdmin
        .connect(delegatee)
        .proposeRemotePoolUpdate(remotePoolUpdate, [delegator.address]);
      expect(await ccipAdmin.proposals(hash)).to.be.greaterThan(0);
    });

    it("should revert if not qualified", async () => {
      const { ccipAdmin, equity } = await loadFixture(deployFixture);
      await expect(
        ccipAdmin.proposeRemotePoolUpdate(remotePoolUpdate, [])
      ).to.revertedWithCustomError(equity, "NotQualified");
    });

    it("should set the correct deadline", async () => {
      const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
      const tx = await ccipAdmin
        .connect(singleVoter)
        .proposeRemotePoolUpdate(remotePoolUpdate, []);
      const block = await tx.getBlock();
      expect(await ccipAdmin.proposals(hash)).to.be.greaterThan(
        block?.timestamp ?? 0 + 7 * 24 * 3600
      );
    });
  });

  describe("applyRemotePoolUpdate", () => {
    it("should apply (add)", async () => {
      const { ccipAdmin, singleVoter, tokenPool } = await loadFixture(
        deployFixture
      );
      remotePoolUpdate.add = true;
      await ccipAdmin
        .connect(singleVoter)
        .proposeRemotePoolUpdate(remotePoolUpdate, []);
      await evm_increaseTime(7 * 24 * 3600);
      const tx = await ccipAdmin.applyRemotePoolUpdate(remotePoolUpdate);
      const receipt = await tx.wait();
      const decoded = decodeFunctionCalledEvents(
        receipt?.logs ?? [],
        tokenPool.interface
      );
      expect(decoded.length).to.equal(1);
      expect(decoded[0].args.name).to.equal("addRemotePool");
    });

    it("should apply (remove)", async () => {
      const { ccipAdmin, singleVoter, tokenPool } = await loadFixture(
        deployFixture
      );
      remotePoolUpdate.add = false;
      await ccipAdmin
        .connect(singleVoter)
        .proposeRemotePoolUpdate(remotePoolUpdate, []);
      await evm_increaseTime(7 * 24 * 3600);
      const tx = await ccipAdmin.applyRemotePoolUpdate(remotePoolUpdate);
      const receipt = await tx.wait();
      const decoded = decodeFunctionCalledEvents(
        receipt?.logs ?? [],
        tokenPool.interface
      );
      expect(decoded.length).to.equal(1);
      expect(decoded[0].args.name).to.equal("removeRemotePool");
    });

    it("should revert if deadline not passed", async () => {
      const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
      await ccipAdmin
        .connect(singleVoter)
        .proposeRemotePoolUpdate(remotePoolUpdate, []);
      await expect(
        ccipAdmin.connect(singleVoter).applyRemotePoolUpdate(remotePoolUpdate)
      ).to.revertedWithCustomError(ccipAdmin, "TooEarly");
    });

    it("should revert if proposal is not known", async () => {
      const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
      await expect(
        ccipAdmin.connect(singleVoter).applyRemotePoolUpdate(remotePoolUpdate)
      ).to.revertedWithCustomError(ccipAdmin, "UnknownProposal");
    });

    it("should remove the deadline", async () => {
      const { ccipAdmin, singleVoter } = await loadFixture(deployFixture);
      const hash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "(bool add,uint64 chain,bytes poolAddress)"],
          ["remotePoolUpdate", remotePoolUpdate]
        )
      );

      await ccipAdmin
        .connect(singleVoter)
        .proposeRemotePoolUpdate(remotePoolUpdate, []);
      await evm_increaseTime(7 * 24 * 3600);
      await ccipAdmin.applyRemotePoolUpdate(remotePoolUpdate);
      expect(await ccipAdmin.proposals(hash)).to.equal(0);
    });
  });
});
