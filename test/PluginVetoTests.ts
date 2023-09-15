import { expect } from "chai";
import { floatToDec18 } from "../scripts/math";
import { ethers } from "hardhat";
import { createContract } from "../scripts/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Frankencoin, StablecoinBridge, TestToken } from "../typechain";
import { evm_increaseTime } from "./helper";

let equityContract, equityAddr, mintingHubContract;
let positionFactoryContract;

describe("Plugin Veto Tests", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let bridge: StablecoinBridge;
  let secondBridge: StablecoinBridge;
  let zchf: Frankencoin;
  let mockXCHF: TestToken;
  let mockDCHF: TestToken;

  before(async () => {
    [owner, alice] = await ethers.getSigners();
    // create contracts
    zchf = await createContract("Frankencoin", [10 * 86_400]);
    equityAddr = await zchf.reserve();
    equityContract = await ethers.getContractAt("Equity", equityAddr);
    positionFactoryContract = await createContract("PositionFactory");
    mintingHubContract = await createContract("MintingHub", [
      zchf.address,
      positionFactoryContract.address,
    ]);
    // mocktoken
    mockXCHF = await createContract("TestToken", ["CryptoFranc", "XCHF", 18]);
    // mocktoken bridge to bootstrap
    let limit = floatToDec18(100_000);
    bridge = await createContract("StablecoinBridge", [
      mockXCHF.address,
      zchf.address,
      limit,
    ]);
    zchf.initialize(bridge.address, "");
    // wait for 1 block
    await evm_increaseTime(60);
    // now we are ready to bootstrap ZCHF with Mock-XCHF
    await mockXCHF.mint(owner.address, limit.div(2));
    await mockXCHF.mint(alice.address, limit.div(2));
    // mint some ZCHF to block bridges without veto
    let amount = floatToDec18(20_000);
    await mockXCHF.connect(alice).approve(bridge.address, amount);
    await bridge.connect(alice).mint(amount);
    // owner also mints some to be able to veto
    await mockXCHF.approve(bridge.address, amount);
    await bridge.mint(amount);
  });

  describe("create secondary bridge plugin", () => {
    it("create mock DCHF token&bridge", async () => {
      let limit = floatToDec18(100_000);
      mockDCHF = await createContract("TestToken", ["Test Name", "Symbol", 18]);
      await mockDCHF.mint(alice.address, floatToDec18(100_000));
      secondBridge = await createContract("StablecoinBridge", [
        mockDCHF.address,
        zchf.address,
        limit,
      ]);
    });
    it("Participant suggests minter", async () => {
      let applicationPeriod = await zchf.MIN_APPLICATION_PERIOD();
      let applicationFee = await zchf.MIN_FEE();
      let msg = "DCHF Bridge";
      await mockXCHF.connect(alice).approve(zchf.address, applicationFee);
      let balance = await zchf.balanceOf(alice.address);
      expect(balance).to.be.greaterThan(applicationFee);
      await expect(
        zchf
          .connect(alice)
          .suggestMinter(
            secondBridge.address,
            applicationPeriod,
            applicationFee,
            msg
          )
      ).to.emit(zchf, "MinterApplied");
    });
    it("can't mint before min period", async () => {
      let amount = floatToDec18(1_000);
      await mockDCHF.connect(alice).approve(secondBridge.address, amount);
      // set allowance
      await expect(
        secondBridge.connect(alice).mint(amount)
      ).to.be.revertedWithCustomError(zchf, "NotMinter");
    });
    it("deny minter", async () => {
      await expect(
        zchf.denyMinter(secondBridge.address, [], "other denied")
      ).to.emit(zchf, "MinterDenied");
      await expect(
        secondBridge.connect(alice).mint(floatToDec18(1_000))
      ).to.be.revertedWithCustomError(zchf, "NotMinter");
    });
  });
});
