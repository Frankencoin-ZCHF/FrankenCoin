import { expect } from "chai";
import { floatToDec18 } from "../scripts/math";
import { ethers } from "hardhat";
import {
  Equity,
  Frankencoin,
  MintingHub,
  Position,
  PositionFactory,
  Savings,
  TestToken,
} from "../typechain";
import { evm_increaseTime } from "./helper";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Savings Tests", () => {
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  let zchf: Frankencoin;
  let equity: Equity;
  let savings: Savings;

  let positionFactory: PositionFactory;
  let mintingHub: MintingHub;

  let position: Position;
  let coin: TestToken;

  before(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    const frankenCoinFactory = await ethers.getContractFactory("Frankencoin");
    zchf = await frankenCoinFactory.deploy(10 * 86400);

    const equityAddr = await zchf.reserve();
    equity = await ethers.getContractAt("Equity", equityAddr);

    const positionFactoryFactory = await ethers.getContractFactory(
      "PositionFactory"
    );
    positionFactory = await positionFactoryFactory.deploy();

    const savingsFactory = await ethers.getContractFactory("Savings");
    savings = await savingsFactory.deploy(zchf.getAddress(), 20000n);

    const mintingHubFactory = await ethers.getContractFactory("MintingHub");
    mintingHub = await mintingHubFactory.deploy(
      await zchf.getAddress(),
      await savings.getAddress(),
      await positionFactory.getAddress()
    );

    // jump start ecosystem
    await zchf.initialize(owner.address, "owner");
    await zchf.initialize(await mintingHub.getAddress(), "mintingHub");
    await zchf.initialize(await savings.getAddress(), "savings");

    await zchf.mint(owner.address, floatToDec18(1000000));
    await zchf.transfer(alice.address, floatToDec18(100000));
    await zchf.transfer(bob.address, floatToDec18(100000));

    // jump start fps
    await equity.invest(floatToDec18(1000), 0);
    await equity.connect(alice).invest(floatToDec18(10000), 0);
    await equity.connect(bob).invest(floatToDec18(10000), 0);

    // test coin
    const coinFactory = await ethers.getContractFactory("TestToken");
    coin = await coinFactory.deploy("Supercoin", "XCOIN", 18);
  });

  const amount = floatToDec18(1000);

  describe("Save some zchf test", () => {
    it("simple save", async () => {
      await zchf.approve(savings.getAddress(), amount);
      await savings["save(uint192)"](amount);

      const r = await savings.savings(owner.address);
      console.log(r);
      expect(r.saved).to.be.equal(amount);
    });

    it("multi save", async () => {
      await zchf.approve(savings.getAddress(), amount * 3n);
      await savings["save(uint192)"](amount);
      await savings["save(uint192)"](amount);
      await savings["save(uint192)"](amount);

      const r = await savings.savings(owner.address);
      console.log(r);
      expect(r.saved).to.be.equal(amount * (1n + 3n));
    });

    it("premature attempt to withdraw", async () => {
      const r = await savings.savings(owner.address);
      const c = await savings.currentTicks();
      console.log("owner ticks", r.ticks);
      console.log("current ticks", c);

      const w = savings.withdraw(owner.address, amount);
      await expect(w).to.be.revertedWithCustomError(savings, "FundsLocked");

      savings.connect(owner).refreshMyBalance();

      const w2 = savings.withdraw(owner.address, amount);
      await expect(w2).to.be.revertedWithCustomError(savings, "FundsLocked");
    });

    it("withdraw savings", async () => {
      const account = await savings.savings(owner.address);
      expect(account.saved).to.be.eq(4n * amount);
      const ticks = await savings.currentTicks();
      const timeLeft = (account.ticks - ticks) / (await savings.currentRatePPM());
      await evm_increaseTime(timeLeft - 1n); // when executing the next transaction, timer will be increased by 1 seconds
      const account2 = await savings.savings(owner.address);
      expect(account2.saved).to.be.eq(4n * amount);
      await savings.withdraw(owner.address, amount);
      expect(await zchf.balanceOf(await zchf.reserve())).to.be.eq(20999999998942795535262n); // unfortunately already a little bit paid 
      await savings.refreshBalance(owner.address);
      await evm_increaseTime(1234);
      const oldBalance = (await savings.savings(owner.address)).saved;
      const oldReserve = await zchf.balanceOf(await zchf.reserve());
      const oldUserTicks = (await savings.savings(owner.address)).ticks;
      const oldSystemTicks = await savings.currentTicks();
      await savings.refreshBalance(owner.address);
      const newBalance = (await savings.savings(owner.address)).saved;
      const newReserve = await zchf.balanceOf(await zchf.reserve());
      const newUserTicks = (await savings.savings(owner.address)).ticks;
      const newSystemTicks = await savings.currentTicks();
      expect(newUserTicks).to.be.eq(newSystemTicks);
      expect(newBalance - oldBalance).to.be.eq(oldReserve - newReserve);
      expect(newBalance - oldBalance).to.be.eq((newUserTicks - oldUserTicks) * oldBalance / 1000000n / 365n / 24n / 3600n);
      await savings.withdraw(owner.address, 10n * amount);
      await expect((await savings.savings(owner.address)).saved).to.be.eq(0n);
    });
  });
});
