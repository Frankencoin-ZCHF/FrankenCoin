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

  describe("Save some zchf test", () => {
    it("no approval", async () => {
      const amount = floatToDec18(1000);
      const r = savings["save(uint192)"](amount);
      await expect(r).to.be.revertedWithCustomError(
        zchf,
        "ERC20InsufficientAllowance"
      );
    });

    it("simple save", async () => {
      const amount = floatToDec18(1000);
      await zchf.approve(savings.getAddress(), amount);
      await savings["save(uint192)"](amount);

      const r = await savings.savings(owner.address);
      console.log(r);
      expect(r.saved).to.be.equal(amount);
    });

    it("multi save", async () => {
      const amount = floatToDec18(1000);
      await zchf.approve(savings.getAddress(), amount * 3n);
      await savings["save(uint192)"](amount);
      await savings["save(uint192)"](amount);
      await savings["save(uint192)"](amount);

      const r = await savings.savings(owner.address);
      console.log(r);
      expect(r.saved).to.be.equal(amount * (1n + 3n));
    });

    it("tries to withdraw, w/o waiting", async () => {
      const r = await savings.savings(owner.address);
      const c = await savings.currentTicks();
      console.log("owner ticks", r.ticks);
      console.log("current ticks", c);

      const amount = floatToDec18(1000);
      const w = savings.withdraw(owner.address, amount);
      await expect(w).to.be.revertedWithCustomError(savings, "FundsLocked");
    });
  });
});
