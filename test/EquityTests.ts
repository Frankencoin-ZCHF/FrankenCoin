import { expect } from "chai";
import { floatToDec18 } from "../scripts/math";
import { ethers } from "hardhat";
import { evm_increaseTime, evm_mine_blocks } from "./helper";
import { Equity, EuroCoin, StablecoinBridge, TestToken } from "../typechain";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Equity Tests", () => {
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  let equity: Equity;
  let bridge: StablecoinBridge;
  let zeur: EuroCoin;
  let xchf: TestToken;

  before(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    const xchfFactory = await ethers.getContractFactory("TestToken");
    xchf = await xchfFactory.deploy("CryptoFranc", "XCHF", 18);
  });

  beforeEach(async () => {
    const euroCoinFactory = await ethers.getContractFactory("EuroCoin");
    zeur = await euroCoinFactory.deploy(10 * 86400);

    let supply = floatToDec18(1000_000);
    const bridgeFactory = await ethers.getContractFactory("StablecoinBridge");
    bridge = await bridgeFactory.deploy(
      await xchf.getAddress(),
      await zeur.getAddress(),
      floatToDec18(100_000_000_000)
    );
    await zeur.initialize(await bridge.getAddress(), "");

    await xchf.mint(owner.address, supply);
    await xchf.approve(await bridge.getAddress(), supply);
    await bridge.mint(supply);
    await zeur.transfer(bob.address, floatToDec18(5000));
    equity = await ethers.getContractAt("Equity", await zeur.reserve());
  });

  describe("basic initialization", () => {
    it("should have symbol ZEUR", async () => {
      let symbol = await zeur.symbol();
      expect(symbol).to.be.equal("ZEUR");
    });

    it("should have symbol EPS", async () => {
      let symbol = await equity.symbol();
      expect(symbol).to.be.equal("EPS");
    });

    it("should support permit interface", async () => {
      let supportsInterface = await equity.supportsInterface("0x9d8ff7da");
      expect(supportsInterface).to.be.true;
    });

    it("should have the right name", async () => {
      let symbol = await equity.name();
      expect(symbol).to.be.equal("EuroCoin Pool Share");
    });

    it("should have initial price 1 ZEUR / EPS", async () => {
      let price = await equity.price();
      expect(price).to.be.equal(BigInt(1e18));
    });

    it("should have some coins", async () => {
      let balance = await zeur.balanceOf(owner.address);
      expect(balance).to.be.equal(floatToDec18(1000_000 - 5000));
    });
  });

  describe("minting shares", () => {
    it("should revert minting less than minimum equity amount", async () => {
      await expect(equity.invest(floatToDec18(999), 0)).to.be.revertedWith(
        "insuf equity"
      );
    });

    it("should revert minting when minted less than expected", async () => {
      await expect(
        equity.invest(floatToDec18(1000), floatToDec18(9999))
      ).to.be.revertedWithoutReason();
    });

    // it("should revert minting when total supply exceeds max of uint96", async () => {
    //   await equity.invest(floatToDec18(1000), 0);
    //   const amount = floatToDec18(80_000_000_000);
    //   await xchf.mint(owner.address, amount);
    //   await xchf.approve(await bridge.getAddress(), amount);
    //   await bridge.mint(amount);
    //   await equity.invest(amount, 0);
    //   await expect(equity.invest(amount, 0)).to.be.revertedWith(
    //     "total supply exceeded"
    //   );
    // });

    it("should create an initial share", async () => {
      const expected = await equity.calculateShares(floatToDec18(1000));
      await zeur.transfer(await equity.getAddress(), 1);
      const price = await equity.price();
      expect(price).to.be.equal(floatToDec18(1));
      await equity.calculateShares(floatToDec18(1000));

      await equity.invest(floatToDec18(1000), expected);
      let balance = await equity.balanceOf(owner.address);
      expect(balance).to.be.equal(floatToDec18(1000));
    });

    it("should create 1000 more shares when adding seven capital plus fees", async () => {
      await equity.invest(floatToDec18(1000), 0);
      let expected = await equity.calculateShares(floatToDec18(7000 / 0.997));
      expect(expected).to.be.approximately(
        floatToDec18(1000),
        floatToDec18(0.01)
      );
      await equity.invest(floatToDec18(7000 / 0.997), expected);
      let balance = await equity.balanceOf(owner.address);
      expect(balance).to.be.approximately(
        floatToDec18(2000),
        floatToDec18(0.01)
      );
    });
  });

  describe("redeem shares", () => {
    beforeEach(async () => {
      await equity.invest(floatToDec18(1000), 0);
      const expected = await equity.calculateShares(floatToDec18(7000 / 0.997));
      await equity.invest(floatToDec18(7000 / 0.997), expected);
    });

    it("should refuse redemption before time passed", async () => {
      expect(await equity.canRedeem(owner.address)).to.be.false;
      await expect(
        equity.redeem(owner.address, floatToDec18(0.1))
      ).to.be.revertedWithoutReason();
    });

    it("should allow redemption after time passed", async () => {
      await evm_increaseTime(90 * 86_400 + 60);
      expect(await equity.canRedeem(owner.address)).to.be.true;

      await expect(
        equity.calculateProceeds((await equity.totalSupply()) * 2n)
      ).to.be.revertedWith("too many shares");

      const redemptionAmount =
        (await equity.balanceOf(owner.address)) - floatToDec18(1000.0);
      const equityCapital = await zeur.balanceOf(await equity.getAddress());
      const proceeds = await equity.calculateProceeds(redemptionAmount);
      expect(proceeds).to.be.approximately(
        (equityCapital * 7n) / 8n,
        (equityCapital * 3n) / 1000n
      );
      expect(proceeds).to.be.below((equityCapital * 7n) / 8n);
    });

    it("should be able to redeem more than expected amounts", async () => {
      await evm_increaseTime(90 * 86_400 + 60);
      expect(await equity.canRedeem(owner.address)).to.be.true;

      const redemptionAmount =
        (await equity.balanceOf(owner.address)) - floatToDec18(1000.0);
      const proceeds = await equity.calculateProceeds(redemptionAmount);
      await expect(
        equity.redeemExpected(owner.address, redemptionAmount, proceeds * 2n)
      ).to.be.revertedWithoutReason();

      const beforeBal = await zeur.balanceOf(alice.address);
      await expect(
        equity.redeemExpected(alice.address, redemptionAmount, proceeds)
      ).to.be.emit(equity, "Trade");
      const afterBal = await zeur.balanceOf(alice.address);
      expect(afterBal - beforeBal).to.be.equal(proceeds);
    });

    it("should be able to redeem allowed shares for share holder", async () => {
      await evm_increaseTime(90 * 86_400 + 60);

      const redemptionAmount =
        (await equity.balanceOf(owner.address)) - floatToDec18(1000.0);
      await equity.approve(alice.address, redemptionAmount);

      const proceeds = await equity.calculateProceeds(redemptionAmount);
      const beforeBal = await zeur.balanceOf(bob.address);
      await expect(
        equity
          .connect(alice)
          .redeemFrom(
            owner.address,
            bob.address,
            redemptionAmount,
            proceeds * 2n
          )
      ).to.be.revertedWithoutReason();
      await equity
        .connect(alice)
        .redeemFrom(owner.address, bob.address, redemptionAmount, proceeds);
      const afterBal = await zeur.balanceOf(bob.address);
      expect(afterBal - beforeBal).to.be.equal(proceeds);
    });
  });

  describe("transfer shares", () => {
    beforeEach(async () => {
      await equity.invest(floatToDec18(1000), 0);
      await equity.connect(bob).invest(floatToDec18(1000), 0);
    });

    it("total votes==sum of owner votes", async () => {
      let other = bob.address;
      let totVotesBefore = await equity.totalVotes();
      let votesBefore = [
        await equity.votes(owner.address),
        await equity.votes(other),
      ];
      let isEqual = totVotesBefore == votesBefore[0];
      if (!isEqual) {
        console.log(`1) total votes before = ${totVotesBefore}`);
        console.log(`1) sum votes before = ${votesBefore}`);
      }
      expect(isEqual).to.be.true;
      let relVotes = await equity.relativeVotes(owner.address);
      expect(relVotes).to.be.eq(BigInt(1e18));
    });

    it("total votes correct after transfer", async () => {
      let amount = 0.1;
      let other = bob.address;
      let totVotesBefore = await equity.totalVotes();
      let votesBefore = [
        await equity.votes(owner.address),
        await equity.votes(other),
      ];
      let balancesBefore = [
        await equity.balanceOf(owner.address),
        await equity.balanceOf(other),
      ];
      await equity.transfer(other, 0);
      await equity.transfer(other, floatToDec18(amount));
      let balancesAfter = [
        await equity.balanceOf(owner.address),
        await equity.balanceOf(other),
      ];
      expect(balancesAfter[1] > balancesBefore[1]).to.be.true;
      let totVotesAfter = await equity.totalVotes();
      let votesAfter = [
        await equity.votes(owner.address),
        await equity.votes(other),
      ];
      let isEqual1 = totVotesBefore == votesBefore[0];
      let isEqual2 = totVotesAfter == votesAfter[0] + votesAfter[1];
      if (!isEqual1 || !isEqual2) {
        console.log(`2) total votes before = ${totVotesBefore}`);
        console.log(`2) votes before = ${votesBefore}`);
        console.log(`2) total votes after = ${totVotesAfter}`);
        console.log(`2) votes after = ${votesAfter}`);
      }
      expect(isEqual1 && isEqual2).to.be.true;
    });

    it("total votes correct after mine", async () => {
      await evm_mine_blocks(2);
      let other = bob.address;
      let totVotesAfter = await equity.totalVotes();
      let votesAfter = [
        await equity.votes(owner.address),
        await equity.votes(other),
      ];
      let isEqual = totVotesAfter == votesAfter[0] + votesAfter[1];
      let isZero = votesAfter[1] == 0n;
      if (!isEqual || isZero) {
        console.log(`3) total votes after = ${totVotesAfter}`);
        console.log(`3) votes after = ${votesAfter}`);
      }
      expect(isEqual && !isZero).to.be.true;
    });

    it("kamikaze", async () => {
      let tx = equity
        .connect(alice)
        .kamikaze([bob.address, bob.address], 1000000n);
      await expect(tx).to.be.reverted; // account 2 has no votes

      await evm_increaseTime(80);
      let balance0 = await equity.balanceOf(owner.address);
      let balance5 = await equity.balanceOf(bob.address);
      let totalSupply = await equity.totalSupply();
      expect(balance0 + balance5).to.be.eq(totalSupply);
      let votesBefore0 = await equity.votes(owner.address);
      let votesBefore5 = await equity.votes(bob.address);
      let totalVotesBefore = await equity.totalVotes();
      expect(votesBefore0 + votesBefore5).to.be.eq(totalVotesBefore);
      await equity.kamikaze(
        [bob.address],
        votesBefore5 + balance5 * BigInt(2 ** 20)
      );
      let votesAfter0 = await equity.votes(owner.address);
      let votesAfter5 = await equity.votes(bob.address);
      expect(votesAfter5).to.be.eq(0);
      let totalVotesA = await equity.totalVotes();
      expect(totalVotesA).to.be.eq(votesAfter0);
    });
  });

  describe("delegate voting power", () => {
    beforeEach(async () => {
      await equity.invest(floatToDec18(1000), 0);
      await equity.connect(bob).invest(floatToDec18(1000), 0);
    });

    it("delegate vote", async () => {
      await equity.connect(bob).delegateVoteTo(alice.address);
      await equity.connect(alice).delegateVoteTo(owner.address);
      let qualified1 = await equity.votesDelegated(owner.address, [
        bob.address,
        alice.address,
      ]);
      let qualified2 = await equity.votesDelegated(owner.address, []);
      expect(qualified1 > qualified2).to.be.true;
      await expect(
        equity.votesDelegated(bob.address, [alice.address])
      ).to.be.revertedWithoutReason();
      await expect(
        equity.votesDelegated(bob.address, [bob.address])
      ).to.be.revertedWithoutReason();
      await expect(
        equity.votesDelegated(owner.address, [alice.address, bob.address])
      ).to.be.revertedWithoutReason();
    });

    it("should revert qualified check when not meet quorum", async () => {
      await zeur.transfer(alice.address, 1);
      await equity.connect(alice).invest(1, 0);
      await expect(
        equity.checkQualified(alice.address, [])
      ).to.be.revertedWithCustomError(equity, "NotQualified");
    });
  });
  describe("restructure cap table", () => {
    it("should revert restructure when have enough equity", async () => {
      await zeur.transfer(await equity.getAddress(), floatToDec18(1000));
      await expect(
        equity.restructureCapTable([], [])
      ).to.be.revertedWithoutReason();
    });

    it("should burn equity balances of given users", async () => {
      await zeur.transfer(await equity.getAddress(), floatToDec18(100));
      await equity.restructureCapTable([], [alice.address, bob.address]);
    });
  });
});
