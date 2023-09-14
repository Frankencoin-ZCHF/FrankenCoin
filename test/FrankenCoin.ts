import chai, { expect } from "chai";
import { floatToDec18, dec18ToFloat } from "../scripts/math";
import { ethers } from "hardhat";
import { createContract } from "../scripts/utils";
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

const limit = floatToDec18(100_000);
describe("FrankenCoin", () => {
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

  describe("Basic initialization", () => {
    it("symbol should be ZCHF", async () => {
      let symbol = await zchf.symbol();
      expect(symbol).to.be.equal("ZCHF");
      let name = await zchf.name();
      expect(name).to.be.equal("Frankencoin");
    });
    it("create mock token", async () => {
      mockXCHF = await createContract("TestToken", ["CryptoFranc", "XCHF", 18]);
      let symbol = await mockXCHF.symbol();
      expect(symbol).to.be.equal("XCHF");
    });
  });

  describe("Initializing Minters", () => {
    before(async () => {
      mockXCHF = await createContract("TestToken", ["CryptoFranc", "XCHF", 18]);
      bridge = await createContract("StablecoinBridge", [
        mockXCHF.address,
        zchf.address,
        limit,
      ]);
    });
    it("bootstrap suggestMinter", async () => {
      let msg = "XCHF Bridge";
      await zchf.initialize(bridge.address, msg);
      let isMinter = await zchf.isMinter(bridge.address);
      expect(isMinter).to.be.true;
    });
    it("should revert initialization when there is supply", async () => {
      let amount = floatToDec18(10000);
      await mockXCHF.approve(bridge.address, amount);
      await bridge.mint(amount);
      await expect(
        zchf.initialize(bridge.address, "Bridge")
      ).to.be.revertedWithoutReason();
    });
    it("should revert minter suggestion when application period is too short", async () => {
      await expect(
        zchf.suggestMinter(owner.address, 9 * 86400, floatToDec18(1000), "")
      ).to.be.revertedWith("PeriodTooShort");
    });
    it("should revert minter suggestion when application fee is too low", async () => {
      await expect(
        zchf.suggestMinter(owner.address, 10 * 86400, floatToDec18(900), "")
      ).to.be.revertedWith("FeeTooLow");
    });
    it("should revert when minter is already registered", async () => {
      await expect(
        zchf.suggestMinter(bridge.address, 10 * 86400, floatToDec18(1000), "")
      ).to.be.revertedWith("AlreadyRegistered");
    });
    it("should revert registering position when not from minters", async () => {
      expect(await zchf.isMinter(owner.address)).to.be.false;
      await expect(zchf.registerPosition(owner.address)).to.be.revertedWith(
        "NotMinter"
      );
    });
    it("should revert denying minters when exceed application period", async () => {
      await expect(
        zchf.suggestMinter(owner.address, 10 * 86400, floatToDec18(1000), "")
      ).to.emit(zchf, "MinterApplied");
      await evm_increaseTime(86400 * 11);
      await expect(zchf.denyMinter(owner.address, [], "")).to.be.revertedWith(
        "TooLate"
      );
    });
  });

  describe("Minting & Burning", () => {
    before(async () => {
      zchf = await createContract("Frankencoin", [10 * 86_400]);
      mockXCHF = await createContract("TestToken", ["CryptoFranc", "XCHF", 18]);
      bridge = await createContract("StablecoinBridge", [
        mockXCHF.address,
        zchf.address,
        limit,
      ]);
    });
    it("should revert minting if minter is not whitelisted", async () => {
      let amount = floatToDec18(10000);
      await mockXCHF.mint(owner.address, amount);
      await mockXCHF.approve(bridge.address, amount);
      await expect(bridge.mint(amount)).to.be.revertedWithCustomError(
        zchf,
        "NotMinter"
      );
      zchf.initialize(bridge.address, "Bridge");
      expect(await zchf.isMinter(bridge.address)).to.be.true;
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
    it("should revert minting with reserve from non minters", async () => {
      await expect(
        zchf.mintWithReserve(owner.address, 1000, 0, 0)
      ).to.be.revertedWith("NotMinter");
    });
    it("should revert burning from non minters", async () => {
      await expect(zchf.burnFrom(owner.address, 1000)).to.be.revertedWith(
        "NotMinter"
      );
    });
    it("should revert burning without reserve from non minters", async () => {
      await expect(
        zchf.burnWithoutReserve(owner.address, 1000)
      ).to.be.revertedWith("NotMinter");
    });
    it("should revert burning with reserve from non minters", async () => {
      await expect(
        zchf.burnWithReserve(owner.address, 1000)
      ).to.be.revertedWith("NotMinter");
    });
    it("should revert burning from with reserve from non minters", async () => {
      await expect(
        zchf.burnFromWithReserve(owner.address, 0, 0)
      ).to.be.revertedWith("NotMinter");
    });
    it("should revert notifying loss from non minters", async () => {
      await expect(zchf.notifyLoss(0)).to.be.revertedWith("NotMinter");
    });
  });
});
