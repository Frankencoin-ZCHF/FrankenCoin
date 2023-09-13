import chai, { expect } from "chai";
import { floatToDec18, dec18ToFloat } from "../scripts/math";
import { ethers } from "hardhat";
import {
  capitalToShares,
  createContract,
  sharesToCapital,
} from "../scripts/utils";
import {
  Equity,
  Frankencoin,
  PositionFactory,
  StablecoinBridge,
  TestToken,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { evm_increaseTime } from "./helper";
import { solidity } from "ethereum-waffle";

chai.use(solidity);

describe("Basic Tests", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let zchf: Frankencoin;
  let equity: Equity;
  let positionFactory: PositionFactory;
  let mockXCHF: TestToken;
  let bridge: StablecoinBridge;

  before(async () => {
    [owner, alice] = await ethers.getSigners();
    // create contracts
    // 10 day application period
    zchf = await createContract("Frankencoin", [10 * 86_400]);
    const equityAddr = await zchf.reserve();
    equity = await ethers.getContractAt("Equity", equityAddr);
    positionFactory = await createContract("PositionFactory");
    await createContract("MintingHub", [zchf.address, positionFactory.address]);
  });

  describe("basic initialization", () => {
    it("symbol should be ZCHF", async () => {
      let symbol = await zchf.symbol();
      expect(symbol).to.be.equal("ZCHF");
      let name = await zchf.name();
      expect(name).to.be.equal("Frankencoin");
    });
  });

  describe("mock bridge", () => {
    const limit = floatToDec18(100_000);

    before(async () => {
      const xchfFactory = await ethers.getContractFactory("TestToken");
      mockXCHF = await xchfFactory.deploy("CryptoFranc", "XCHF", 18);
      bridge = await createContract("StablecoinBridge", [
        mockXCHF.address,
        zchf.address,
        limit,
      ]);
    });
    it("create mock token", async () => {
      let symbol = await mockXCHF.symbol();
      expect(symbol).to.be.equal("XCHF");
    });
    it("minting fails if not approved", async () => {
      let amount = floatToDec18(10000);
      await mockXCHF.mint(owner.address, amount);
      let balanceBefore = await zchf.balanceOf(owner.address);
      await mockXCHF.approve(bridge.address, amount);
      // set allowance
      await expect(bridge.mint(amount)).to.be.revertedWithCustomError(
        zchf,
        "NotMinter"
      );
    });
    it("bootstrap suggestMinter", async () => {
      let msg = "XCHF Bridge";
      await zchf.initialize(bridge.address, msg);
      let isMinter = await zchf.isMinter(bridge.address);
      expect(isMinter).to.be.true;
    });

    it("minter of XCHF-bridge should receive ZCHF", async () => {
      let amount = floatToDec18(5000);
      let balanceBefore = await zchf.balanceOf(owner.address);
      // set allowance
      await mockXCHF.approve(bridge.address, amount);
      await bridge.mint(amount);

      let balanceXCHFOfBridge = await mockXCHF.balanceOf(bridge.address);
      let balanceAfter = await zchf.balanceOf(owner.address);
      let ZCHFReceived = dec18ToFloat(balanceAfter.sub(balanceBefore));
      let isBridgeBalanceCorrect = dec18ToFloat(balanceXCHFOfBridge) == 5000;
      let isSenderBalanceCorrect = ZCHFReceived == 5000;
      if (!isBridgeBalanceCorrect || !isSenderBalanceCorrect) {
        console.log(
          "Bridge received XCHF tokens ",
          dec18ToFloat(balanceXCHFOfBridge)
        );
        console.log("Sender received ZCH tokens ", ZCHFReceived);
        expect(isBridgeBalanceCorrect).to.be.true;
        expect(isSenderBalanceCorrect).to.be.true;
      }
    });
    it("should revert initialization when there is supply", async () => {
      await expect(
        zchf.initialize(bridge.address, "Bridge")
      ).to.be.revertedWithoutReason();
    });
    it("burner of XCHF-bridge should receive XCHF", async () => {
      let amount = floatToDec18(50);
      let balanceBefore = await zchf.balanceOf(owner.address);
      let balanceXCHFBefore = await mockXCHF.balanceOf(owner.address);
      await zchf.approve(bridge.address, amount);
      let allowance1 = await zchf.allowance(owner.address, bridge.address);
      expect(allowance1).to.be.eq(amount);
      let allowance2 = await zchf.allowance(owner.address, alice.address);
      expect(allowance2).to.be.eq(floatToDec18(0));
      await zchf.burn(amount);
      await bridge.burn(amount);
      await bridge.burnAndSend(owner.address, amount);

      let balanceXCHFOfBridge = await mockXCHF.balanceOf(bridge.address);
      let balanceXCHFAfter = await mockXCHF.balanceOf(owner.address);
      let balanceAfter = await zchf.balanceOf(owner.address);
      let ZCHFReceived = dec18ToFloat(balanceAfter.sub(balanceBefore));
      let XCHFReceived = dec18ToFloat(balanceXCHFAfter.sub(balanceXCHFBefore));
      let isBridgeBalanceCorrect = dec18ToFloat(balanceXCHFOfBridge) == 4900;
      let isSenderBalanceCorrect = ZCHFReceived == -150;
      let isXCHFBalanceCorrect = XCHFReceived == 100;
      if (
        !isBridgeBalanceCorrect ||
        !isSenderBalanceCorrect ||
        !isXCHFBalanceCorrect
      ) {
        console.log(
          "Bridge balance XCHF tokens ",
          dec18ToFloat(balanceXCHFOfBridge)
        );
        console.log("Sender burned ZCH tokens ", -ZCHFReceived);
        console.log("Sender received XCHF tokens ", XCHFReceived);
        expect(isBridgeBalanceCorrect).to.be.true;
        expect(isSenderBalanceCorrect).to.be.true;
        expect(isXCHFBalanceCorrect).to.be.true;
      }
    });
    it("should revert minting when exceed limit", async () => {
      let amount = limit.add(100);
      await mockXCHF.approve(bridge.address, amount);
      await expect(bridge.mint(amount)).to.be.revertedWith("Limit");
    });
    it("should revert minting when bridge is expired", async () => {
      let amount = floatToDec18(1);
      await evm_increaseTime(60 * 60 * 24 * 7 * 53); // pass 53 weeks
      await mockXCHF.approve(bridge.address, amount);
      await expect(bridge.mint(amount)).to.be.revertedWithCustomError(
        bridge,
        "Expired"
      );
    });
  });
  describe("exchanges shares & pricing", () => {
    it("deposit XCHF to reserve pool and receive share tokens", async () => {
      let amount = 1000; // amount we will deposit
      let fAmount = floatToDec18(1000); // amount we will deposit
      let balanceBefore = await equity.balanceOf(owner.address);
      let balanceBeforeZCHF = await zchf.balanceOf(owner.address);
      let fTotalShares = await equity.totalSupply();
      let fTotalCapital = await zchf.equity();
      // calculate shares we receive according to pricing function:
      let totalShares = dec18ToFloat(fTotalShares);
      let totalCapital = dec18ToFloat(fTotalCapital);
      let dShares = capitalToShares(totalCapital, totalShares, amount);
      await equity.invest(fAmount, 0);
      let balanceAfter = await equity.balanceOf(owner.address);
      let balanceAfterZCHF = await zchf.balanceOf(owner.address);
      let poolTokenShares = dec18ToFloat(balanceAfter.sub(balanceBefore));
      let ZCHFReceived = dec18ToFloat(balanceAfterZCHF.sub(balanceBeforeZCHF));
      let isPoolShareAmountCorrect = Math.abs(poolTokenShares - dShares) < 1e-7;
      let isSenderBalanceCorrect = ZCHFReceived == -1000;
      if (!isPoolShareAmountCorrect || !isSenderBalanceCorrect) {
        console.log("Pool token shares received = ", poolTokenShares);
        console.log("ZCHF tokens deposited = ", -ZCHFReceived);
        expect(isPoolShareAmountCorrect).to.be.true;
        expect(isSenderBalanceCorrect).to.be.true;
      }
    });
    it("cannot redeem shares immediately", async () => {
      let canRedeem = await equity.canRedeem(owner.address);
      expect(canRedeem).to.be.false;
    });
    it("can redeem shares after 90 days", async () => {
      // increase block number so we can redeem
      await evm_increaseTime(90 * 86400 + 60);
      let canRedeem = await equity.canRedeem(owner.address);
      expect(canRedeem).to.be.true;
    });
    it("redeem 1 share", async () => {
      let amountShares = 1;
      let fAmountShares = floatToDec18(amountShares);
      let fTotalShares = await equity.totalSupply();
      let fTotalCapital = await zchf.balanceOf(equity.address);
      // calculate capital we receive according to pricing function:
      let totalShares = dec18ToFloat(fTotalShares);
      let totalCapital = dec18ToFloat(fTotalCapital);
      let dCapital = sharesToCapital(totalCapital, totalShares, amountShares);

      let sharesBefore = await equity.balanceOf(owner.address);
      let capitalBefore = await zchf.balanceOf(owner.address);
      await equity.redeem(owner.address, fAmountShares);

      let sharesAfter = await equity.balanceOf(owner.address);
      let capitalAfter = await zchf.balanceOf(owner.address);

      let poolTokenSharesRec = dec18ToFloat(sharesAfter.sub(sharesBefore));
      let ZCHFReceived = dec18ToFloat(capitalAfter.sub(capitalBefore));
      let feeRate = ZCHFReceived / dCapital;
      let isZCHFAmountCorrect = Math.abs(feeRate - 0.997) <= 1e-5;
      let isPoolShareAmountCorrect = poolTokenSharesRec == -amountShares;
      if (!isZCHFAmountCorrect || !isZCHFAmountCorrect) {
        console.log("ZCHF tokens received = ", ZCHFReceived);
        console.log("ZCHF tokens expected = ", dCapital);
        console.log("Fee = ", feeRate);
        console.log("Pool shares redeemed = ", -poolTokenSharesRec);
        console.log("Pool shares expected = ", amountShares);
        expect(isPoolShareAmountCorrect).to.be.true;
        expect(isZCHFAmountCorrect).to.be.true;
      }
    });
  });
});
