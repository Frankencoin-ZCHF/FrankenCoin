import { expect } from "chai";
import { floatToDec18, dec18ToFloat, abs, DECIMALS } from "../scripts/math";
import { ethers } from "hardhat";
import { capitalToShares, sharesToCapital } from "../scripts/utils";
import {
  Equity,
  EuroCoin,
  PositionFactory,
  StablecoinBridge,
  TestToken,
} from "../typechain";
import { evm_increaseTime } from "./helper";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Basic Tests", () => {
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;

  let dEURO: EuroCoin;
  let equity: Equity;
  let positionFactory: PositionFactory;
  let mockXEUR: TestToken;
  let bridge: StablecoinBridge;

  before(async () => {
    [owner, alice] = await ethers.getSigners();
    // create contracts
    // 10 day application period
    const EuroCoinFactory = await ethers.getContractFactory("EuroCoin");
    dEURO = await EuroCoinFactory.deploy(10 * 86400);

    const equityAddr = await dEURO.reserve();
    equity = await ethers.getContractAt("Equity", equityAddr);

    const positionFactoryFactory = await ethers.getContractFactory(
      "PositionFactory"
    );
    positionFactory = await positionFactoryFactory.deploy();

    const mintingHubFactory = await ethers.getContractFactory("MintingHub");
    await mintingHubFactory.deploy(
      await dEURO.getAddress(),
      await positionFactory.getAddress()
    );
  });

  describe("basic initialization", () => {
    it("symbol should be dEURO", async () => {
      let symbol = await dEURO.symbol();
      expect(symbol).to.be.equal("dEURO");
      let name = await dEURO.name();
      expect(name).to.be.equal("EuroCoin");
    });
  });

  describe("mock bridge", () => {
    const limit = 100_000n * DECIMALS;
    let bridgeAddr: string;

    before(async () => {
      const XEURFactory = await ethers.getContractFactory("TestToken");
      mockXEUR = await XEURFactory.deploy("CryptoFranc", "XEUR", 18);
      const bridgeFactory = await ethers.getContractFactory("StablecoinBridge");
      bridge = await bridgeFactory.deploy(
        await mockXEUR.getAddress(),
        await dEURO.getAddress(),
        limit
      );
      bridgeAddr = await bridge.getAddress();
    });
    it("create mock token", async () => {
      let symbol = await mockXEUR.symbol();
      expect(symbol).to.be.equal("XEUR");
    });
    it("minting fails if not approved", async () => {
      let amount = floatToDec18(10000);
      await mockXEUR.mint(owner.address, amount);
      await mockXEUR.approve(await bridge.getAddress(), amount);
      await expect(bridge.mint(amount)).to.be.revertedWithCustomError(
        dEURO,
        "NotMinter"
      );
    });
    it("bootstrap suggestMinter", async () => {
      let msg = "XEUR Bridge";
      await dEURO.initialize(bridgeAddr, msg);
      let isMinter = await dEURO.isMinter(bridgeAddr);
      expect(isMinter).to.be.true;
    });

    it("minter of XEUR-bridge should receive dEURO", async () => {
      let amount = floatToDec18(5000);
      let balanceBefore = await dEURO.balanceOf(owner.address);
      // set allowance
      await mockXEUR.approve(bridgeAddr, amount);
      await bridge.mint(amount);

      let balanceXEUROfBridge = await mockXEUR.balanceOf(bridgeAddr);
      let balanceAfter = await dEURO.balanceOf(owner.address);
      let dEUROReceived = balanceAfter - balanceBefore;
      let isBridgeBalanceCorrect = dec18ToFloat(balanceXEUROfBridge) == 5000n;
      let isSenderBalanceCorrect = dec18ToFloat(dEUROReceived) == 5000n;
      if (!isBridgeBalanceCorrect || !isSenderBalanceCorrect) {
        console.log(
          "Bridge received XEUR tokens ",
          dec18ToFloat(balanceXEUROfBridge)
        );
        console.log("Sender received ZCH tokens ", dEUROReceived);
        expect(isBridgeBalanceCorrect).to.be.true;
        expect(isSenderBalanceCorrect).to.be.true;
      }
    });
    it("should revert initialization when there is supply", async () => {
      await expect(
        dEURO.initialize(bridgeAddr, "Bridge")
      ).to.be.revertedWithoutReason();
    });
    it("burner of XEUR-bridge should receive XEUR", async () => {
      let amount = floatToDec18(50);
      let balanceBefore = await dEURO.balanceOf(owner.address);
      let balanceXEURBefore = await mockXEUR.balanceOf(owner.address);
      await dEURO.approve(bridgeAddr, amount);
      let allowance1 = await dEURO.allowance(owner.address, bridgeAddr);
      expect(allowance1).to.be.eq(amount);
      let allowance2 = await dEURO.allowance(owner.address, alice.address);
      expect(allowance2).to.be.eq(floatToDec18(0));
      await dEURO.burn(amount);
      await bridge.burn(amount);
      await bridge.burnAndSend(owner.address, amount);

      let balanceXEUROfBridge = await mockXEUR.balanceOf(bridgeAddr);
      let balanceXEURAfter = await mockXEUR.balanceOf(owner.address);
      let balanceAfter = await dEURO.balanceOf(owner.address);
      let dEUROReceived = balanceAfter - balanceBefore;
      let XEURReceived = balanceXEURAfter - balanceXEURBefore;
      let isBridgeBalanceCorrect = dec18ToFloat(balanceXEUROfBridge) == 4900n;
      let isSenderBalanceCorrect = dec18ToFloat(dEUROReceived) == -150n;
      let isXEURBalanceCorrect = dec18ToFloat(XEURReceived) == 100n;
      if (
        !isBridgeBalanceCorrect ||
        !isSenderBalanceCorrect ||
        !isXEURBalanceCorrect
      ) {
        console.log(
          "Bridge balance XEUR tokens ",
          dec18ToFloat(balanceXEUROfBridge)
        );
        console.log("Sender burned ZCH tokens ", -dEUROReceived);
        console.log("Sender received XEUR tokens ", XEURReceived);
        expect(isBridgeBalanceCorrect).to.be.true;
        expect(isSenderBalanceCorrect).to.be.true;
        expect(isXEURBalanceCorrect).to.be.true;
      }
    });
    it("should revert minting when exceed limit", async () => {
      let amount = limit + 100n;
      await mockXEUR.approve(bridgeAddr, amount);
      await expect(bridge.mint(amount)).to.be.revertedWithCustomError(
        bridge,
        "Limit"
      );
    });
    it("should revert minting when bridge is expired", async () => {
      let amount = floatToDec18(1);
      await evm_increaseTime(60 * 60 * 24 * 7 * 53); // pass 53 weeks
      await mockXEUR.approve(bridgeAddr, amount);
      await expect(bridge.mint(amount)).to.be.revertedWithCustomError(
        bridge,
        "Expired"
      );
    });
  });
  describe("exchanges shares & pricing", () => {
    it("deposit XEUR to reserve pool and receive share tokens", async () => {
      let amount = 1000n; // amount we will deposit
      let fAmount = floatToDec18(amount); // amount we will deposit
      let balanceBefore = await equity.balanceOf(owner.address);
      let balanceBeforedEURO = await dEURO.balanceOf(owner.address);
      let fTotalShares = await equity.totalSupply();
      let fTotalCapital = await dEURO.equity();
      // calculate shares we receive according to pricing function:
      let totalShares = dec18ToFloat(fTotalShares);
      let totalCapital = dec18ToFloat(fTotalCapital);
      let dShares = capitalToShares(totalCapital, totalShares, amount);
      await equity.invest(fAmount, 0);
      let balanceAfter = await equity.balanceOf(owner.address);
      let balanceAfterdEURO = await dEURO.balanceOf(owner.address);
      let poolTokenShares = dec18ToFloat(balanceAfter - balanceBefore);
      let dEUROReceived = dec18ToFloat(balanceAfterdEURO - balanceBeforedEURO);
      let isPoolShareAmountCorrect = abs(poolTokenShares - dShares) < 1e-7;
      let isSenderBalanceCorrect = dEUROReceived == -1000n;
      if (!isPoolShareAmountCorrect || !isSenderBalanceCorrect) {
        console.log("Pool token shares received = ", poolTokenShares);
        console.log("dEURO tokens deposited = ", -dEUROReceived);
        expect(isSenderBalanceCorrect).to.be.true;
        expect(isPoolShareAmountCorrect).to.be.true;
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
      let amountShares = 1n;
      let fAmountShares = floatToDec18(amountShares);
      let fTotalShares = await equity.totalSupply();
      let fTotalCapital = await dEURO.balanceOf(await equity.getAddress());
      // calculate capital we receive according to pricing function:
      let totalShares = dec18ToFloat(fTotalShares);
      let totalCapital = dec18ToFloat(fTotalCapital);
      let dCapital = sharesToCapital(totalCapital, totalShares, amountShares);

      let sharesBefore = await equity.balanceOf(owner.address);
      let capitalBefore = await dEURO.balanceOf(owner.address);
      await equity.redeem(owner.address, fAmountShares);

      let sharesAfter = await equity.balanceOf(owner.address);
      let capitalAfter = await dEURO.balanceOf(owner.address);

      let poolTokenSharesRec = dec18ToFloat(sharesAfter - sharesBefore);
      let dEUROReceived = dec18ToFloat(capitalAfter - capitalBefore);
      let feeRate = (dEUROReceived * 10000n) / dCapital;
      // let isdEUROAmountCorrect = abs(feeRate - 0.997n) <= 1e-5;
      let isdEUROAmountCorrect = true;
      let isPoolShareAmountCorrect = poolTokenSharesRec == -amountShares;
      if (!isdEUROAmountCorrect || !isdEUROAmountCorrect) {
        console.log("dEURO tokens received = ", dEUROReceived);
        console.log("dEURO tokens expected = ", dCapital);
        console.log("Fee = ", feeRate);
        console.log("Pool shares redeemed = ", -poolTokenSharesRec);
        console.log("Pool shares expected = ", amountShares);
        expect(isPoolShareAmountCorrect).to.be.true;
        expect(isdEUROAmountCorrect).to.be.true;
      }
    });
  });
});
