import { expect } from "chai";
import { floatToDec18 } from "../scripts/math";
import { ethers } from "hardhat";
import { Frankencoin, StablecoinBridge, TestToken } from "../typechain";
import { evm_increaseTime } from "./helper";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Plugin Veto Tests", () => {
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;

  let bridge: StablecoinBridge;
  let secondBridge: StablecoinBridge;
  let zchf: Frankencoin;
  let mockXCHF: TestToken;
  let mockDCHF: TestToken;

  before(async () => {
    [owner, alice] = await ethers.getSigners();
    // create contracts
    const frankenCoinFactory = await ethers.getContractFactory("Frankencoin");
    zchf = await frankenCoinFactory.deploy(10 * 86400, ethers.ZeroAddress);

    // mocktoken
    const xchfFactory = await ethers.getContractFactory("TestToken");
    mockXCHF = await xchfFactory.deploy("CryptoFranc", "XCHF", 18);
    // mocktoken bridge to bootstrap
    let limit = floatToDec18(100_000);
    const bridgeFactory = await ethers.getContractFactory("StablecoinBridge");
    bridge = await bridgeFactory.deploy(
      await mockXCHF.getAddress(),
      await zchf.getAddress(),
      limit
    );
    await zchf.initialize(await bridge.getAddress(), "");
    // wait for 1 block
    await evm_increaseTime(60);
    // now we are ready to bootstrap ZCHF with Mock-XCHF
    await mockXCHF.mint(owner.address, limit / 2n);
    await mockXCHF.mint(alice.address, limit / 2n);
    // mint some ZCHF to block bridges without veto
    let amount = floatToDec18(20_000);
    await mockXCHF.connect(alice).approve(await bridge.getAddress(), amount);
    await bridge.connect(alice).mint(amount);
    // owner also mints some to be able to veto
    await mockXCHF.approve(await bridge.getAddress(), amount);
    await bridge.mint(amount);
  });

  describe("create secondary bridge plugin", () => {
    it("create mock DCHF token&bridge", async () => {
      let limit = floatToDec18(100_000);
      const xchfFactory = await ethers.getContractFactory("TestToken");
      mockDCHF = await xchfFactory.deploy("Test Name", "Symbol", 18);
      await mockDCHF.mint(alice.address, floatToDec18(100_000));

      const bridgeFactory = await ethers.getContractFactory("StablecoinBridge");
      secondBridge = await bridgeFactory.deploy(
        await mockDCHF.getAddress(),
        await zchf.getAddress(),
        limit
      );
    });
    it("Participant suggests minter", async () => {
      let applicationPeriod = await zchf.MIN_APPLICATION_PERIOD();
      let applicationFee = await zchf.MIN_FEE();
      let msg = "DCHF Bridge";
      await mockXCHF
        .connect(alice)
        .approve(await zchf.getAddress(), applicationFee);
      let balance = await zchf.balanceOf(alice.address);
      expect(balance).to.be.greaterThan(applicationFee);
      await expect(
        zchf
          .connect(alice)
          .suggestMinter(
            await secondBridge.getAddress(),
            applicationPeriod,
            applicationFee,
            msg
          )
      ).to.emit(zchf, "MinterApplied");
    });
    it("can't mint before min period", async () => {
      let amount = floatToDec18(1_000);
      await mockDCHF
        .connect(alice)
        .approve(await secondBridge.getAddress(), amount);
      // set allowance
      await expect(
        secondBridge.connect(alice).mint(amount)
      ).to.be.revertedWithCustomError(zchf, "NotMinter");
    });
    it("deny minter", async () => {
      await expect(
        zchf.denyMinter(await secondBridge.getAddress(), [], "other denied")
      ).to.emit(zchf, "MinterDenied");
      await expect(
        secondBridge.connect(alice).mint(floatToDec18(1_000))
      ).to.be.revertedWithCustomError(zchf, "NotMinter");
    });
  });
});
