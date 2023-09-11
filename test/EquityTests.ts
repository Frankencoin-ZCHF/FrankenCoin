// @ts-nocheck
import { expect } from "chai";
import { floatToDec18, dec18ToFloat } from "../scripts/math";
import { ethers } from "hardhat";
const BN = ethers.BigNumber;
import { createContract } from "../scripts/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { evm_increaseTime, evm_mine_blocks } from "./helper";
import { Equity, Frankencoin, StablecoinBridge, TestToken } from "../typechain";

describe("Equity Tests", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let equity: Equity;
  let bridge: StablecoinBridge;
  let zchf: Frankencoin;
  let xchf: TestToken;

  before(async () => {
    [owner, alice, bob] = await ethers.getSigners();
    // create contracts
    xchf = await createContract("TestToken", ["CryptoFranc", "XCHF", 18]);
    zchf = await createContract("Frankencoin", [10 * 86_400]);
    let supply = floatToDec18(1000_000);
    bridge = await createContract("StablecoinBridge", [
      xchf.address,
      zchf.address,
      supply,
    ]);
    await zchf.initialize(bridge.address, "");

    await xchf.mint(owner.address, supply);
    await xchf.approve(bridge.address, supply);
    await bridge.connect(owner).mint(supply);
    equity = await ethers.getContractAt("Equity", await zchf.reserve());
  });

  describe("basic initialization", () => {
    it("should have symbol ZCHF", async () => {
      let symbol = await zchf.symbol();
      expect(symbol).to.be.equal("ZCHF");
    });
    it("should have symbol FPS", async () => {
      let symbol = await equity.symbol();
      expect(symbol).to.be.equal("FPS");
    });
    it("should have the right name", async () => {
      let symbol = await equity.name();
      expect(symbol).to.be.equal("Frankencoin Pool Share");
    });
    it("should have inital price 1 ZCHF / FPS", async () => {
      let price = await equity.price();
      expect(price).to.be.equal(BN.from(10).pow(18));
    });
    it("should have some coins", async () => {
      let balance = await zchf.balanceOf(owner.address);
      expect(balance).to.be.equal(floatToDec18(1000_000));
    });
  });

  describe("minting shares", () => {
    it("should create an initial share", async () => {
      await equity.invest(floatToDec18(1000), 0);
      let balance = await equity.balanceOf(owner.address);
      expect(balance).to.be.equal(floatToDec18(1000));
    });
    it("should create 1000 more shares when adding seven capital plus fees", async () => {
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
    it("should refuse redemption before time passed", async () => {
      expect(await equity.canRedeem(owner.address)).to.be.false;
      await expect(
        equity.redeem(owner.address, floatToDec18(0.1))
      ).to.be.revertedWithoutReason();
    });
    it("should allow redemption after time passed", async () => {
      await evm_increaseTime(90 * 86_400 + 60);
      expect(await equity.canRedeem(owner.address)).to.be.true;
      let redemptionAmount = (await equity.balanceOf(owner.address)).sub(
        floatToDec18(1000.0)
      );
      let equityCapital = dec18ToFloat(await zchf.balanceOf(equity.address));
      let bnred = BN.from(redemptionAmount.toString());
      let proceeds = await equity.calculateProceeds(bnred);
      expect(proceeds).to.be.approximately(
        floatToDec18((equityCapital / 8) * 7),
        floatToDec18(equityCapital * 0.003)
      );
      expect(proceeds).to.be.below(floatToDec18((equityCapital / 8) * 7));
    });
  });

  describe("transfer shares", () => {
    it("total votes==sum of owner votes", async () => {
      let other = bob.address;
      let totVotesBefore = await equity.totalVotes();
      let votesBefore = [
        await equity.votes(owner.address),
        await equity.votes(other),
      ];
      let isEqual = totVotesBefore - votesBefore[0] == 0;
      if (!isEqual) {
        console.log(`1) total votes before = ${totVotesBefore}`);
        console.log(`1) sum votes before = ${votesBefore}`);
      }
      expect(isEqual).to.be.true;
      let relVotes = await equity.relativeVotes(owner.address);
      expect(relVotes).to.be.eq(BN.from(10).pow(18));
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
      let isEqual1 = totVotesBefore - votesBefore[0] == 0;
      let isEqual2 = totVotesAfter - votesAfter[0] - votesAfter[1] == 0;
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
      let isEqual = totVotesAfter.sub(votesAfter[0]).sub(votesAfter[1]) == 0;
      let isZero = votesAfter[1] == 0;
      if (!isEqual || isZero) {
        console.log(`3) total votes after = ${totVotesAfter}`);
        console.log(`3) votes after = ${votesAfter}`);
      }
      expect(isEqual && !isZero).to.be.true;
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
      await expect(equity.votesDelegated(bob.address, [alice.address])).to.be
        .reverted;
    });

    it("kamikaze", async () => {
      let tx = equity
        .connect(alice)
        .kamikaze([bob.address, bob.address], BN.from(1000000));
      await expect(tx).to.be.reverted; // account 2 has no votes

      await evm_increaseTime(80);
      let balance0 = await equity.balanceOf(owner.address);
      let balance5 = await equity.balanceOf(bob.address);
      let totalSupply = await equity.totalSupply();
      expect(balance0.add(balance5)).to.be.eq(totalSupply);
      let votesBefore0 = await equity.votes(owner.address);
      let votesBefore5 = await equity.votes(bob.address);
      let totalVotesBefore = await equity.totalVotes();
      expect(votesBefore0.add(votesBefore5)).to.be.eq(totalVotesBefore);
      await equity.kamikaze(
        [bob.address],
        votesBefore5.add(balance5.mul(BN.from(2).pow(20)))
      );
      let votesAfter0 = await equity.votes(owner.address);
      let votesAfter5 = await equity.votes(bob.address);
      expect(votesAfter5).to.be.eq(0);
      let totalVotesA = await equity.totalVotes();
      expect(totalVotesA).to.be.eq(votesAfter0);
    });
  });
});
