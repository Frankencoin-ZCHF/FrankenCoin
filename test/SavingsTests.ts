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
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { evm_increaseTime } from "./helper";

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

  beforeEach(async () => {
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

    await zchf.mint(owner.address, floatToDec18(2_000_000));
    await zchf.transfer(alice.address, floatToDec18(100_000));
    await zchf.transfer(bob.address, floatToDec18(100_000));

    // jump start fps
    await equity.invest(floatToDec18(1000), 0);
    await equity.connect(alice).invest(floatToDec18(10_000), 0);
    await equity.connect(bob).invest(floatToDec18(10_000), 0);
    await equity.invest(floatToDec18(1_000_000), 0);

    // test coin
    const coinFactory = await ethers.getContractFactory("TestToken");
    coin = await coinFactory.deploy("Supercoin", "XCOIN", 18);
  });

  const amount = floatToDec18(1000);

  describe("Save some zchf", () => {
    // it("no approval, reverted", async () => {
    //   const amount = floatToDec18(1000);
    //   const r = savings["save(uint192)"](amount);
    //   await expect(r).to.be.revertedWithCustomError(
    //     zchf,
    //     "ERC20InsufficientAllowance"
    //   );
    // });

    it("no approval needed, minters power", async () => {
      const amount = floatToDec18(1000);
      await savings["save(uint192)"](amount);
    });

    it("simple save", async () => {
      await zchf.approve(savings.getAddress(), amount);
      await savings["save(uint192)"](amount);
      const r = await savings.savings(owner.address);
      expect(r.saved).to.be.equal(amount);
    });

    it("multi save", async () => {
      await zchf.approve(savings.getAddress(), amount * 3n);
      await savings["save(uint192)"](amount);
      await savings["save(uint192)"](amount);
      await savings["save(uint192)"](amount);
      const r = await savings.savings(owner.address);
      expect(r.saved).to.be.equal(amount * 3n);
    });

    it("premature attempt to withdraw", async () => {
      await zchf.approve(savings.getAddress(), amount);
      await savings["save(uint192)"](amount);
      const w = savings.withdraw(owner.address, amount);
      await expect(w).to.be.revertedWithCustomError(savings, "FundsLocked");
    });

    it("any interests after 365days", async () => {
      const i0 = await zchf.balanceOf(owner.address);
      const amount = floatToDec18(10_000);
      await zchf.approve(savings.getAddress(), amount);
      await savings["save(uint192)"](amount);
      await evm_increaseTime(365 * 86_400);
      await savings.withdraw(owner.address, 2n * amount); // as much as possible, 2x amount is enough
      /* \__ Will cause an Error, if not registered as minter. __/
        savings addr: 0xc351628EB244ec633d5f21fBD6621e1a683B1181
        equity addr: 0x1301d297043f564235EA41560f61681253BbD48B

        Error: VM Exception while processing transaction: reverted with custom error 'ERC20InsufficientAllowance("0x1301d297043f564235EA41560f61681253BbD48B", 0, 192328779807204464738)'
        at Frankencoin.permit (contracts/utils/ERC20PermitLight.sol:21)
        at Frankencoin.transferFrom (contracts/utils/ERC20.sol:123)
        at Savings.refresh (contracts/Savings.sol:68)
        at Savings.withdraw (contracts/Savings.sol:109)

        The SC "Savings" is not a "minter" aka "no minter superpower". So it CAN NOT withdraw any zchf without approval, 
        this will cause an error while trying to "transferFrom" the equity some interests.
      */
      const i1 = await zchf.balanceOf(owner.address);
      expect(i1).to.be.greaterThan(i0);
    });

    it("withdraw savings", async () => {
      const account = await savings.savings(owner.address);
      expect(account.saved).to.be.eq(4n * amount);
      const ticks = await savings.currentTicks();
      const timeLeft =
        (account.ticks - ticks) / (await savings.currentRatePPM());
      await evm_increaseTime(timeLeft - 1n); // when executing the next transaction, timer will be increased by 1 seconds
      const account2 = await savings.savings(owner.address);
      expect(account2.saved).to.be.eq(4n * amount);
      await savings.withdraw(owner.address, amount);
      expect(await zchf.balanceOf(await zchf.reserve())).to.be.eq(
        20999999998942795535262n
      ); // unfortunately already a little bit paid
      await savings.refreshBalance(owner.address);
      await evm_increaseTime(1234);
      const oldBalance = (await savings.savings(owner.address)).saved;
      const oldReserve = await zchf.balanceOf(await zchf.reserve());
      await savings.refreshMyBalance();
      await savings.refreshBalance(owner.address);
      const newBalance = (await savings.savings(owner.address)).saved;
      const newReserve = await zchf.balanceOf(await zchf.reserve());
      expect(newBalance - oldBalance).to.be.eq(oldReserve - newReserve);
      expect(newBalance - oldBalance).to.be.eq(
        (1237n * (await savings.currentRatePPM()) * oldBalance) /
          1000000n /
          365n /
          24n /
          3600n
      );
      const all = await savings.withdraw(owner.address, 10n * amount);
      await expect(all).to.be.eq(newBalance);
    });
  });
});
