import { CCIPLocalSimulator } from "../typechain";
import { ethers } from "hardhat";
import { evm_increaseTime } from "./helper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

describe.only("Bridged Governance Tests", () => {
  async function deployFixture() {
    const [minter, user1, user2, user3, user4, user5] =
      await ethers.getSigners();

    // Setup CCIP environment
    const ccipLocalSimualtorFactory = await ethers.getContractFactory(
      "CCIPLocalSimulator"
    );
    const ccipLocalSimulator: CCIPLocalSimulator =
      await ccipLocalSimualtorFactory.deploy();
    const ccipLocalSimulatorConfig = await ccipLocalSimulator.configuration();

    // Setup Frankencoin contracts
    const frankenCoinFactory = await ethers.getContractFactory("Frankencoin");
    const zchf = await frankenCoinFactory.deploy(10 * 864000);
    await zchf.initialize(minter.address, "");

    const equity = await ethers.getContractAt("Equity", await zchf.reserve());

    // Setup bridged contracts
    const bridgedGovernanceSenderFactory = await ethers.getContractFactory(
      "BridgedGovernanceSender"
    );
    const bridgedGovernanceSender = await bridgedGovernanceSenderFactory.deploy(
      await equity.getAddress(),
      ccipLocalSimulatorConfig.sourceRouter_,
      ccipLocalSimulatorConfig.linkToken_
    );

    const bridgedGovernanceFactory = await ethers.getContractFactory(
      "BridgedGovernance"
    );
    const bridgedGovernance = await bridgedGovernanceFactory.deploy(
      ccipLocalSimulatorConfig.destinationRouter_,
      ccipLocalSimulatorConfig.chainSelector_,
      await bridgedGovernanceSender.getAddress()
    );

    // Setup users
    await zchf.mintWithReserve(
      user1.address,
      ethers.parseEther("10000"),
      "10000",
      "0"
    );
    await zchf.mintWithReserve(
      user2.address,
      ethers.parseEther("10000"),
      "10000",
      "0"
    );
    await zchf.mintWithReserve(
      user3.address,
      ethers.parseEther("10000"),
      "10000",
      "0"
    );
    await zchf.mintWithReserve(
      user4.address,
      ethers.parseEther("10000"),
      "10000",
      "0"
    );
    await zchf.mintWithReserve(
      user5.address,
      ethers.parseEther("10000"),
      "10000",
      "0"
    );

    await equity.connect(user1).invest(ethers.parseEther("5000"), 0);
    await equity.connect(user2).invest(ethers.parseEther("5000"), 0);
    await equity.connect(user3).invest(ethers.parseEther("5000"), 0);
    await equity.connect(user4).invest(ethers.parseEther("5000"), 0);
    await equity.connect(user5).invest(ethers.parseEther("5000"), 0);

    await evm_increaseTime(100 * 24 * 60 * 60); // 100 days

    return {
      ccipLocalSimulator,
      ccipLocalSimulatorConfig,
      zchf,
      equity,
      bridgedGovernanceSender,
      bridgedGovernance,
      minter,
      user1,
      user2,
      user3,
      user4,
      user5,
    };
  }

  describe("syncVotesPayNative", () => {
    it("should transfer single user votes", async () => {
      const fixture = await loadFixture(deployFixture);
      const fee = await fixture.bridgedGovernanceSender.getCCIPFee(
        await fixture.bridgedGovernance.getAddress(),
        fixture.ccipLocalSimulatorConfig.chainSelector_,
        [await fixture.user1.getAddress()],
        ethers.ZeroAddress
      );

      const tx = await fixture.bridgedGovernanceSender
        .connect(fixture.user1)
        .syncVotesPayNative(
          await fixture.bridgedGovernance.getAddress(),
          fixture.ccipLocalSimulatorConfig.chainSelector_,
          [fixture.user1.address],
          { value: fee }
        );
      await tx.wait();

      // checks
      expect(
        await fixture.bridgedGovernance.votes(fixture.user1.address)
      ).to.equal(await fixture.equity.votes(fixture.user1.address));
    });

    it("should transfer single user delegation", async () => {
      const fixture = await loadFixture(deployFixture);

      await fixture.equity
        .connect(fixture.user1)
        .delegateVoteTo(await fixture.user2.getAddress());
      const fee = await fixture.bridgedGovernanceSender.getCCIPFee(
        await fixture.bridgedGovernance.getAddress(),
        fixture.ccipLocalSimulatorConfig.chainSelector_,
        [await fixture.user1.getAddress()],
        ethers.ZeroAddress
      );

      const tx = await fixture.bridgedGovernanceSender
        .connect(fixture.user1)
        .syncVotesPayNative(
          await fixture.bridgedGovernance.getAddress(),
          fixture.ccipLocalSimulatorConfig.chainSelector_,
          [fixture.user1.address],
          { value: fee }
        );
      await tx.wait();

      // checks
      expect(
        await fixture.bridgedGovernance.delegates(fixture.user1.address)
      ).to.equal(await fixture.user2.getAddress());
    });

    it("should transfer totalVotes along", async () => {
      const fixture = await loadFixture(deployFixture);
      const fee = await fixture.bridgedGovernanceSender.getCCIPFee(
        await fixture.bridgedGovernance.getAddress(),
        fixture.ccipLocalSimulatorConfig.chainSelector_,
        [await fixture.user1.getAddress()],
        ethers.ZeroAddress
      );

      const tx = await fixture.bridgedGovernanceSender
        .connect(fixture.user1)
        .syncVotesPayNative(
          await fixture.bridgedGovernance.getAddress(),
          fixture.ccipLocalSimulatorConfig.chainSelector_,
          [fixture.user1.address],
          { value: fee }
        );
      await tx.wait();

      // checks
      expect(await fixture.bridgedGovernance.totalVotes()).to.equal(
        await fixture.equity.totalVotes()
      );
    });

    it("should transfer multiple users", async () => {
      const fixture = await loadFixture(deployFixture);
      const fee = await fixture.bridgedGovernanceSender.getCCIPFee(
        await fixture.bridgedGovernance.getAddress(),
        fixture.ccipLocalSimulatorConfig.chainSelector_,
        [
          await fixture.user1.getAddress(),
          await fixture.user2.getAddress(),
          await fixture.user3.getAddress(),
          await fixture.user4.getAddress(),
        ],
        ethers.ZeroAddress
      );

      const tx = await fixture.bridgedGovernanceSender
        .connect(fixture.user1)
        .syncVotesPayNative(
          await fixture.bridgedGovernance.getAddress(),
          fixture.ccipLocalSimulatorConfig.chainSelector_,
          [
            await fixture.user1.getAddress(),
            await fixture.user2.getAddress(),
            await fixture.user3.getAddress(),
            await fixture.user4.getAddress(),
          ],
          { value: fee }
        );
      await tx.wait();

      // checks
      expect(
        await fixture.bridgedGovernance.votes(fixture.user1.address)
      ).to.equal(await fixture.equity.votes(fixture.user1.address));
      expect(
        await fixture.bridgedGovernance.votes(fixture.user2.address)
      ).to.equal(await fixture.equity.votes(fixture.user2.address));
      expect(
        await fixture.bridgedGovernance.votes(fixture.user3.address)
      ).to.equal(await fixture.equity.votes(fixture.user3.address));
      expect(
        await fixture.bridgedGovernance.votes(fixture.user4.address)
      ).to.equal(await fixture.equity.votes(fixture.user4.address));
    });

    it("should transfer multiple user delegation", async () => {
      const fixture = await loadFixture(deployFixture);

      await fixture.equity
        .connect(fixture.user1)
        .delegateVoteTo(await fixture.user2.getAddress());
      await fixture.equity
        .connect(fixture.user3)
        .delegateVoteTo(await fixture.user2.getAddress());
      await fixture.equity
        .connect(fixture.user4)
        .delegateVoteTo(await fixture.user2.getAddress());

      const fee = await fixture.bridgedGovernanceSender.getCCIPFee(
        await fixture.bridgedGovernance.getAddress(),
        fixture.ccipLocalSimulatorConfig.chainSelector_,
        [
          await fixture.user1.getAddress(),
          await fixture.user2.getAddress(),
          await fixture.user3.getAddress(),
          await fixture.user4.getAddress(),
        ],
        ethers.ZeroAddress
      );

      const tx = await fixture.bridgedGovernanceSender
        .connect(fixture.user1)
        .syncVotesPayNative(
          await fixture.bridgedGovernance.getAddress(),
          fixture.ccipLocalSimulatorConfig.chainSelector_,
          [
            await fixture.user1.getAddress(),
            await fixture.user2.getAddress(),
            await fixture.user3.getAddress(),
            await fixture.user4.getAddress(),
          ],
          { value: fee }
        );
      await tx.wait();

      // checks
      expect(
        await fixture.bridgedGovernance.delegates(fixture.user1.address)
      ).to.equal(await fixture.user2.getAddress());
      expect(
        await fixture.bridgedGovernance.delegates(fixture.user3.address)
      ).to.equal(await fixture.user2.getAddress());
      expect(
        await fixture.bridgedGovernance.delegates(fixture.user4.address)
      ).to.equal(await fixture.user2.getAddress());
      expect(
        await fixture.bridgedGovernance.delegates(fixture.user2.address)
      ).to.equal(ethers.ZeroAddress);
    });

    it("should update votes", async () => {
      const fixture = await loadFixture(deployFixture);
      const fee = await fixture.bridgedGovernanceSender.getCCIPFee(
        await fixture.bridgedGovernance.getAddress(),
        fixture.ccipLocalSimulatorConfig.chainSelector_,
        [await fixture.user1.getAddress()],
        ethers.ZeroAddress
      );

      const votesBefore = await fixture.equity.votes(
        await fixture.user1.getAddress()
      );

      // transfer initial votes
      await (
        await fixture.bridgedGovernanceSender
          .connect(fixture.user1)
          .syncVotesPayNative(
            await fixture.bridgedGovernance.getAddress(),
            fixture.ccipLocalSimulatorConfig.chainSelector_,
            [await fixture.user1.getAddress()],
            { value: fee }
          )
      ).wait();

      expect(
        await fixture.bridgedGovernance.votes(await fixture.user1.getAddress())
      ).eq(await fixture.equity.votes(await fixture.user1.getAddress()));

      await fixture.equity
        .connect(fixture.user1)
        .redeem(await fixture.user1.getAddress(), ethers.parseEther("1"));

      const votesAfter = await fixture.equity.votes(
        await fixture.user1.getAddress()
      );
      expect(votesAfter).to.lessThan(votesBefore);

      // transfer updated votes
      await (
        await fixture.bridgedGovernanceSender
          .connect(fixture.user1)
          .syncVotesPayNative(
            await fixture.bridgedGovernance.getAddress(),
            fixture.ccipLocalSimulatorConfig.chainSelector_,
            [await fixture.user1.getAddress()],
            { value: fee }
          )
      ).wait();

      expect(
        await fixture.bridgedGovernance.votes(await fixture.user1.getAddress())
      ).to.equal(await fixture.equity.votes(await fixture.user1.getAddress()));
    });

    it("should update delegation", async () => {
      const fixture = await loadFixture(deployFixture);
      const fee = await fixture.bridgedGovernanceSender.getCCIPFee(
        await fixture.bridgedGovernance.getAddress(),
        fixture.ccipLocalSimulatorConfig.chainSelector_,
        [await fixture.user1.getAddress()],
        ethers.ZeroAddress
      );

      const user2Addr = await fixture.user2.getAddress();
      await fixture.equity.connect(fixture.user1).delegateVoteTo(user2Addr);

      // transfer delegation
      await (
        await fixture.bridgedGovernanceSender
          .connect(fixture.user1)
          .syncVotesPayNative(
            await fixture.bridgedGovernance.getAddress(),
            fixture.ccipLocalSimulatorConfig.chainSelector_,
            [await fixture.user1.getAddress()],
            { value: fee }
          )
      ).wait();

      expect(
        await fixture.bridgedGovernance.delegates(
          await fixture.user1.getAddress()
        )
      ).to.equal(user2Addr);

      const user3Addr = await fixture.user3.getAddress();
      await fixture.equity.connect(fixture.user1).delegateVoteTo(user3Addr);

      // transfer redelegation
      await (
        await fixture.bridgedGovernanceSender
          .connect(fixture.user1)
          .syncVotesPayNative(
            await fixture.bridgedGovernance.getAddress(),
            fixture.ccipLocalSimulatorConfig.chainSelector_,
            [await fixture.user1.getAddress()],
            { value: fee }
          )
      ).wait();

      expect(
        await fixture.bridgedGovernance.delegates(
          await fixture.user1.getAddress()
        )
      ).to.equal(user3Addr);
    });
  });
});
