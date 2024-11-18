import { expect } from "chai";
import { floatToDec18, dec18ToFloat, DECIMALS } from "../scripts/math";
import { ethers } from "hardhat";
import { evm_increaseTime } from "./helper";
import {
  Equity,
  EuroCoin,
  MintingHub,
  Position,
  StablecoinBridge,
  TestToken,
} from "../typechain";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

let mockX;

describe("Position Tests", () => {
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let charles: HardhatEthersSigner;

  let dEURO: EuroCoin;
  let mintingHub: MintingHub;
  let bridge: StablecoinBridge;
  let equity: Equity;
  let mockVOL: TestToken;

  let limit: bigint;

  before(async () => {
    [owner, alice, bob, charles] = await ethers.getSigners();
    // create contracts
    const EuroCoinFactory = await ethers.getContractFactory("EuroCoin");
    dEURO = await EuroCoinFactory.deploy(10 * 86400);
    equity = await ethers.getContractAt("Equity", await dEURO.reserve());

    const positionFactoryFactory = await ethers.getContractFactory(
      "PositionFactory"
    );
    const positionFactory = await positionFactoryFactory.deploy();

    const mintingHubFactory = await ethers.getContractFactory("MintingHub");
    mintingHub = await mintingHubFactory.deploy(
      await dEURO.getAddress(),
      await positionFactory.getAddress()
    );
    // mocktoken
    const testTokenFactory = await ethers.getContractFactory("TestToken");
    mockXEUR = await testTokenFactory.deploy("CryptoFranc", "XEUR", 18);
    // mocktoken bridge to bootstrap
    limit = floatToDec18(1_000_000);
    const bridgeFactory = await ethers.getContractFactory("StablecoinBridge");
    bridge = await bridgeFactory.deploy(
      await mockXEUR.getAddress(),
      await dEURO.getAddress(),
      limit
    );
    await dEURO.initialize(await bridge.getAddress(), "XEUR Bridge");
    // create a minting hub too while we have no dEURO supply
    await dEURO.initialize(await mintingHub.getAddress(), "Minting Hub");

    // wait for 1 block
    await evm_increaseTime(60);
    // now we are ready to bootstrap dEURO with Mock-XEUR
    await mockXEUR.mint(owner.address, limit / 3n);
    await mockXEUR.mint(alice.address, limit / 3n);
    await mockXEUR.mint(bob.address, limit / 3n);
    // mint some dEURO to block bridges without veto
    let amount = floatToDec18(20_000);
    await mockXEUR.connect(alice).approve(await bridge.getAddress(), amount);
    await bridge.connect(alice).mint(amount);
    await mockXEUR.connect(owner).approve(await bridge.getAddress(), amount);
    await bridge.connect(owner).mint(amount);
    await mockXEUR.connect(bob).approve(await bridge.getAddress(), amount);
    await bridge.connect(bob).mint(amount);
    // vol tokens
    mockVOL = await testTokenFactory.deploy("Volatile Token", "VOL", 18);
    amount = floatToDec18(500_000);
    await mockVOL.mint(owner.address, amount);
    await mockVOL.mint(alice.address, amount);
    await mockVOL.mint(bob.address, amount);
  });

  let positionAddr: string, positionContract: Position;
  let clonePositionAddr: string, clonePositionContract: Position;
  let fee = 0.01;
  let reserve = 0.1;
  let mintAmount = 100;
  let initialLimit = floatToDec18(550_000);
  let fMintAmount = floatToDec18(mintAmount);
  let fLimit;
  let fGlblZCHBalanceOfCloner: bigint;
  let initialCollateral = 110;
  let initialCollateralClone = 4;
  let challengeAmount = 0;
  let challengeNumber = 0;

  describe("Use Minting Hub", () => {
    let collateral: string;
    let fliqPrice = floatToDec18(5000);
    let minCollateral = floatToDec18(1);
    let fInitialCollateral = floatToDec18(initialCollateral);
    let duration = 60n * 86_400n;
    let fFees = BigInt(fee * 1_000_000);
    let fReserve = BigInt(reserve * 1_000_000);
    let challengePeriod = BigInt(3 * 86400); // 3 days

    before(async () => {
      collateral = await mockVOL.getAddress();
    });

    it("should revert position opening when initial period is less than 3 days", async () => {
      await mockVOL
        .connect(owner)
        .approve(await mintingHub.getAddress(), fInitialCollateral);
      await expect(
        mintingHub.openPosition(
          collateral,
          minCollateral,
          fInitialCollateral,
          initialLimit,
          86400 * 2,
          duration,
          challengePeriod,
          fFees,
          fliqPrice,
          fReserve
        )
      ).to.be.revertedWithoutReason();
    });
    it("should revert creating position when annual interest is less than 1M PPM", async () => {
      await expect(
        mintingHub.openPosition(
          collateral,
          minCollateral,
          fInitialCollateral,
          initialLimit,
          86400 * 2,
          duration,
          challengePeriod,
          2 * 1_000_000,
          fliqPrice,
          fReserve
        )
      ).to.be.revertedWithoutReason();
    });
    it("should revert creating position when reserve fee is less than 1M PPM", async () => {
      await expect(
        mintingHub.openPosition(
          collateral,
          minCollateral,
          fInitialCollateral,
          initialLimit,
          86400 * 2,
          duration,
          challengePeriod,
          fFees,
          fliqPrice,
          2 * 1_000_000
        )
      ).to.be.revertedWithoutReason();
    });
    it("should revert creating position when initial collateral is less than minimal", async () => {
      await expect(
        mintingHub.openPosition(
          collateral,
          minCollateral,
          minCollateral / 2n,
          initialLimit,
          86400 * 2,
          duration,
          challengePeriod,
          fFees,
          fliqPrice,
          fReserve
        )
      ).to.be.revertedWith("must start with min col");
    });
    it("should revert creating position when minimal collateral is not worth of at least 5k dEURO", async () => {
      await expect(
        mintingHub.openPosition(
          collateral,
          minCollateral,
          fInitialCollateral,
          initialLimit,
          86400 * 2,
          duration,
          challengePeriod,
          fFees,
          floatToDec18(4000),
          fReserve
        )
      ).to.be.revertedWithoutReason();
    });
    it("should revert creating position when collateral token has +25 decimals", async () => {
      const testTokenFactory = await ethers.getContractFactory("TestToken");
      const testToken = await testTokenFactory.deploy("Test", "Test", 25);
      await expect(
        mintingHub.openPosition(
          await testToken.getAddress(),
          minCollateral,
          fInitialCollateral,
          initialLimit,
          86400 * 2,
          duration,
          challengePeriod,
          fFees,
          floatToDec18(4000),
          fReserve
        )
      ).to.be.revertedWithoutReason();
    });
    it("create position", async () => {
      let openingFeedEURO = await mintingHub.OPENING_FEE();
      await mockVOL.approve(await mintingHub.getAddress(), fInitialCollateral);
      let balBefore = await dEURO.balanceOf(owner.address);
      let balBeforeVOL = await mockVOL.balanceOf(owner.address);
      let tx = await mintingHub.openPositionOneWeek(
        collateral,
        minCollateral,
        fInitialCollateral,
        initialLimit,
        duration,
        challengePeriod,
        fFees,
        fliqPrice,
        fReserve
      );
      let rc = await tx.wait();
      const topic =
        "0x591ede549d7e337ac63249acd2d7849532b0a686377bbf0b0cca6c8abd9552f2"; // PositionOpened
      const log = rc?.logs.find((x) => x.topics.indexOf(topic) >= 0);
      positionAddr = "0x" + log?.topics[2].substring(26);
      positionContract = await ethers.getContractAt(
        "Position",
        positionAddr,
        owner
      );
      let balAfter = await dEURO.balanceOf(owner.address);
      let balAfterVOL = await mockVOL.balanceOf(owner.address);
      let ddEURO = dec18ToFloat(balAfter - balBefore);
      let dVOL = dec18ToFloat(balAfterVOL - balBeforeVOL);
      expect(dVOL).to.be.equal(-initialCollateral);
      expect(ddEURO).to.be.equal(-dec18ToFloat(openingFeedEURO));
      let currentFees = await positionContract.calculateCurrentFee();
      expect(currentFees).to.be.eq(1643);
    });
    it("require cooldown", async () => {
      let tx = positionContract
        .connect(owner)
        .mint(owner.address, floatToDec18(5));
      await expect(tx).to.be.revertedWithCustomError(positionContract, "Hot");
    });
    it("should revert minting from non owner", async () => {
      await expect(
        positionContract.connect(alice).mint(owner.address, 100)
      ).to.be.revertedWithCustomError(positionContract, "NotOwner");
    });
    it("should revert minting when there is a challange", async () => {
      await mockVOL.approve(await mintingHub.getAddress(), fInitialCollateral);
      let tx = await mintingHub.openPositionOneWeek(
        collateral,
        minCollateral,
        fInitialCollateral,
        initialLimit,
        duration,
        challengePeriod,
        fFees,
        fliqPrice,
        fReserve
      );
      let rc = await tx.wait();
      const topic =
        "0x591ede549d7e337ac63249acd2d7849532b0a686377bbf0b0cca6c8abd9552f2"; // PositionOpened
      const log = rc?.logs.find((x) => x.topics.indexOf(topic) >= 0);
      const positionAddr = "0x" + log?.topics[2].substring(26);
      const positionContract = await ethers.getContractAt(
        "Position",
        positionAddr,
        owner
      );
      challengeAmount = initialCollateralClone / 2;
      let fchallengeAmount = floatToDec18(challengeAmount);
      let price = await positionContract.price();
      await mockVOL.approve(await mintingHub.getAddress(), fchallengeAmount);
      await mintingHub.challenge(
        await positionContract.getAddress(),
        fchallengeAmount,
        price
      );
      await expect(
        positionContract.mint(owner.address, floatToDec18(10))
      ).to.be.revertedWithCustomError(positionContract, "Challenged");
    });
    it("try clone after 7 days but before collateral was withdrawn", async () => {
      // "wait" 7 days...
      await evm_increaseTime(7 * 86_400 + 60);

      let fInitialCollateralClone = floatToDec18(initialCollateralClone);
      let fdEUROAmount = floatToDec18(1000);
      // send some collateral and dEURO to the cloner
      await mockVOL.transfer(alice.address, fInitialCollateralClone);
      await dEURO.transfer(alice.address, fdEUROAmount);

      await mockVOL
        .connect(alice)
        .approve(await mintingHub.getAddress(), fInitialCollateralClone);
      fGlblZCHBalanceOfCloner = await dEURO.balanceOf(alice.address);

      let expiration = await positionContract.expiration();
      let availableLimit = await positionContract.limitForClones();
      expect(availableLimit).to.be.equal(0);
      let tx = mintingHub
        .connect(alice)
        .clone(positionAddr, fInitialCollateralClone, fMintAmount, expiration);
      await expect(tx).to.be.revertedWithCustomError(
        positionContract,
        "LimitExceeded"
      );

      let colbal1 = await mockVOL.balanceOf(positionAddr);
      await positionContract
        .connect(owner)
        .withdrawCollateral(owner.address, floatToDec18(100)); // make sure it works the next time
      let colbal2 = await mockVOL.balanceOf(positionAddr);
      expect(dec18ToFloat(colbal1)).to.be.equal(dec18ToFloat(colbal2) + 100n);
      let availableLimit2 = await positionContract.limitForClones();
      expect(availableLimit2).to.be.greaterThan(availableLimit);
    });
    it("get loan", async () => {
      await evm_increaseTime(7 * 86_400); // 14 days passed in total

      fLimit = await positionContract.limit();
      limit = dec18ToFloat(fLimit);
      let amount = BigInt(1e18) * 10_000n;
      expect(amount).to.be.lessThan(fLimit);
      let fdEUROBefore = await dEURO.balanceOf(owner.address);
      let expectedAmount = await positionContract.getUsableMint(amount, true);
      expect(expectedAmount).to.be.eq(BigInt(1e16) * 898548n);

      expect(await positionContract.getUsableMint(amount, false)).to.be.equal(
        9000n * BigInt(1e18)
      );

      await positionContract.connect(owner).mint(owner.address, amount); //).to.emit("PositionOpened");
      let currentFees = await positionContract.calculateCurrentFee();
      expect(currentFees).to.be.eq(1452n); // 53 days of a 1% yearly interest

      let fdEUROAfter = await dEURO.balanceOf(owner.address);
      let dEUROMinted = fdEUROAfter - fdEUROBefore;
      expect(expectedAmount).to.be.equal(dEUROMinted);
    });
    it("should revert cloning for invalid position", async () => {
      let fInitialCollateralClone = floatToDec18(initialCollateralClone);
      fGlblZCHBalanceOfCloner = await dEURO.balanceOf(alice.address);

      let start = await positionContract.start();
      let expiration = await positionContract.expiration();
      let duration = (expiration - start) / 2n;
      let newExpiration = expiration - duration;
      await expect(
        mintingHub
          .connect(alice)
          .clone(
            owner.address,
            fInitialCollateralClone,
            fMintAmount,
            newExpiration
          )
      ).to.be.revertedWithCustomError(mintingHub, "InvalidPos");
    });
    it("should revert cloning when new expiration is greater than original one", async () => {
      let fInitialCollateralClone = floatToDec18(initialCollateralClone);
      fGlblZCHBalanceOfCloner = await dEURO.balanceOf(alice.address);

      let expiration = await positionContract.expiration();
      await expect(
        mintingHub
          .connect(alice)
          .clone(
            positionAddr,
            fInitialCollateralClone,
            fMintAmount,
            expiration + 100n
          )
      ).to.be.revertedWithoutReason();
    });
    it("should revert cloning from non minting hub", async () => {
      await expect(
        positionContract.initializeClone(owner.address, 0, 0, 0, 0)
      ).to.be.revertedWithCustomError(positionContract, "NotHub");
    });
    it("should revert cloning position with insufficient initial collateral", async () => {
      let expiration = await positionContract.expiration();
      let newExpiration = expiration - duration;
      await expect(
        mintingHub
          .connect(alice)
          .clone(positionAddr, 0, fMintAmount, newExpiration)
      ).to.be.revertedWithCustomError(
        positionContract,
        "InsufficientCollateral"
      );
    });
    it("clone position", async () => {
      let fInitialCollateralClone = floatToDec18(initialCollateralClone);
      fGlblZCHBalanceOfCloner = await dEURO.balanceOf(alice.address);

      let fees = await positionContract.calculateCurrentFee();
      let start = await positionContract.start();
      let expiration = await positionContract.expiration();
      let duration = (expiration - start) / 2n;
      let newExpiration = expiration - duration;
      let tx = await mintingHub
        .connect(alice)
        .clone(
          positionAddr,
          fInitialCollateralClone,
          fMintAmount,
          newExpiration
        );
      let rc = await tx.wait();
      const topic =
        "0x591ede549d7e337ac63249acd2d7849532b0a686377bbf0b0cca6c8abd9552f2"; // PositionOpened
      const log = rc?.logs.find((x) => x.topics.indexOf(topic) >= 0);
      clonePositionAddr = "0x" + log?.topics[2].substring(26);
      clonePositionContract = await ethers.getContractAt(
        "Position",
        clonePositionAddr,
        alice
      );
      let newFees = await clonePositionContract.calculateCurrentFee();
      expect(fees / 2n).to.be.approximately(newFees, 50);
    });
    it("correct collateral", async () => {
      let col = await mockVOL.balanceOf(clonePositionAddr);
      expect(col).to.be.equal(floatToDec18(initialCollateralClone));
    });
    it("global mint limit retained", async () => {
      let fLimit0 = await clonePositionContract.limit();
      let fLimit1 = await positionContract.limit();
      let glblLimit = dec18ToFloat(fLimit0 + fLimit1);
      if (glblLimit != BigInt(limit)) {
        console.log("new global limit =", glblLimit);
        console.log("original global limit =", limit);
      }
      expect(glblLimit).to.be.equal(limit);

      let minted = await positionContract.minted();
      let avaiable = fLimit1 - minted;
      await expect(
        positionContract.mint(owner.address, avaiable + 100n)
      ).to.be.revertedWithCustomError(positionContract, "LimitExceeded");
    });
    it("correct fees charged", async () => {
      // fees:
      // - reserve contribution (temporary fee)
      // - yearlyInterestPPM
      // - position fee (or clone fee)
      let reserveContributionPPM =
        await clonePositionContract.reserveContribution();
      let yearlyInterestPPM = await clonePositionContract.annualInterestPPM();

      let fBalanceAfter = await dEURO.balanceOf(alice.address);
      let mintAfterFees =
        (BigInt(mintAmount) *
          (1000_000n -
            (28n * yearlyInterestPPM) / 365n -
            reserveContributionPPM)) /
        1000_000n;
      let cloneFeeCharged =
        fBalanceAfter - fGlblZCHBalanceOfCloner - mintAfterFees * BigInt(1e18);
      expect(cloneFeeCharged).to.be.approximately(0, BigInt(1e18)); // no extra fees when cloning
    });
    it("clone position with too much mint", async () => {
      let fInitialCollateralClone = floatToDec18(initialCollateralClone);
      let fdEUROAmount = floatToDec18(1000);
      // send some collateral and dEURO to the cloner
      await mockVOL.transfer(alice.address, fInitialCollateralClone);
      await dEURO.transfer(alice.address, fdEUROAmount);

      await mockVOL
        .connect(alice)
        .approve(await mintingHub.getAddress(), fInitialCollateralClone);
      fGlblZCHBalanceOfCloner = await dEURO.balanceOf(alice.address);
      let tx = mintingHub
        .connect(alice)
        .clone(positionAddr, fInitialCollateralClone, initialLimit, 0);
      await expect(tx).to.be.revertedWithCustomError(
        positionContract,
        "LimitExceeded"
      );
    });
    it("repay position", async () => {
      let cloneOwner = await clonePositionContract.connect(alice).owner();
      expect(cloneOwner).to.be.eq(alice.address);
      let fInitialCollateralClone = floatToDec18(initialCollateralClone);
      let withdrawTx = clonePositionContract.withdrawCollateral(
        cloneOwner,
        fInitialCollateralClone
      );
      await expect(withdrawTx).to.be.revertedWithCustomError(
        clonePositionContract,
        "InsufficientCollateral"
      );

      let minted = await clonePositionContract.minted();
      let reservePPM = await clonePositionContract.reserveContribution();
      let repayAmount = minted - (minted * reservePPM) / 1000000n;
      let reserve = await dEURO.calculateAssignedReserve(minted, reservePPM);
      expect(reserve + repayAmount).to.be.eq(minted);

      await clonePositionContract.repay(repayAmount - reserve);
      let minted1 = await clonePositionContract.minted();
      let reserve1 = await dEURO.calculateAssignedReserve(minted1, reservePPM);
      let repayAmount1 = minted1 - reserve1;
      await clonePositionContract.repay(repayAmount1);
      await clonePositionContract.withdrawCollateral(
        cloneOwner,
        fInitialCollateralClone
      );
      let result = await clonePositionContract.isClosed();
      await expect(result).to.be.true;
    });
    it("should revert minting when the position is expired", async () => {
      await evm_increaseTime(86400 * 61);
      await expect(
        positionContract.mint(owner.address, floatToDec18(10))
      ).to.be.revertedWithCustomError(positionContract, "Expired");
    });
    it("should revert reducing limit from non hub", async () => {
      await mockVOL.approve(await mintingHub.getAddress(), fInitialCollateral);
      let tx = await mintingHub.openPositionOneWeek(
        collateral,
        minCollateral,
        fInitialCollateral,
        initialLimit,
        duration,
        challengePeriod,
        fFees,
        fliqPrice,
        fReserve
      );
      let rc = await tx.wait();
      const topic =
        "0x591ede549d7e337ac63249acd2d7849532b0a686377bbf0b0cca6c8abd9552f2"; // PositionOpened
      const log = rc?.logs.find((x) => x.topics.indexOf(topic) >= 0);
      positionAddr = "0x" + log?.topics[2].substring(26);
      positionContract = await ethers.getContractAt(
        "Position",
        positionAddr,
        owner
      );
      await expect(
        positionContract.reduceLimitForClone(0)
      ).to.be.revertedWithCustomError(positionContract, "Hot");
      await evm_increaseTime(86400 * 7);
      await expect(
        positionContract.reduceLimitForClone(0)
      ).to.be.revertedWithCustomError(positionContract, "NotHub");
    });
    it("should revert cloning when it is expired", async () => async () => {
      await evm_increaseTime(86400 * 61);
      let fInitialCollateralClone = floatToDec18(initialCollateralClone);
      fGlblZCHBalanceOfCloner = await dEURO.balanceOf(alice.address);
      let expiration = await positionContract.expiration();

      await expect(
        mintingHub
          .connect(alice)
          .clone(positionAddr, fInitialCollateralClone, fMintAmount, expiration)
      ).to.be.revertedWithCustomError(positionContract, "Expired");
    });
    it("should revert reducing limit when there is a challenge", async () => {
      challengeAmount = initialCollateralClone / 2;
      let fchallengeAmount = floatToDec18(challengeAmount);
      let price = await positionContract.price();
      await mockVOL.approve(await mintingHub.getAddress(), fchallengeAmount);
      await mintingHub.challenge(positionAddr, fchallengeAmount, price);
      challengeNumber++;
      await expect(
        positionContract.reduceLimitForClone(0)
      ).to.be.revertedWithCustomError(positionContract, "Challenged");
    });
  });
  describe("denying position", () => {
    it("create position", async () => {
      let collateral = await mockVOL.getAddress();
      let fliqPrice = floatToDec18(5000);
      let minCollateral = floatToDec18(1);
      let fInitialCollateral = floatToDec18(initialCollateral);
      let duration = BigInt(60 * 86_400);
      let fFees = BigInt(fee * 1_000_000);
      let fReserve = BigInt(reserve * 1_000_000);
      let openingFeedEURO = await mintingHub.OPENING_FEE();
      let challengePeriod = BigInt(3 * 86400); // 3 days
      await mockVOL
        .connect(owner)
        .approve(await mintingHub.getAddress(), fInitialCollateral);
      let balBefore = await dEURO.balanceOf(owner.address);
      let balBeforeVOL = await mockVOL.balanceOf(owner.address);
      let tx = await mintingHub.openPositionOneWeek(
        collateral,
        minCollateral,
        fInitialCollateral,
        initialLimit,
        duration,
        challengePeriod,
        fFees,
        fliqPrice,
        fReserve
      );
      let rc = await tx.wait();
      const topic =
        "0x591ede549d7e337ac63249acd2d7849532b0a686377bbf0b0cca6c8abd9552f2"; // PositionOpened
      const log = rc?.logs.find((x) => x.topics.indexOf(topic) >= 0);
      positionAddr = "0x" + log?.topics[2].substring(26);
      let balAfter = await dEURO.balanceOf(owner.address);
      let balAfterVOL = await mockVOL.balanceOf(owner.address);
      let ddEURO = dec18ToFloat(balAfter - balBefore);
      let dVOL = dec18ToFloat(balAfterVOL - balBeforeVOL);
      expect(dVOL).to.be.equal(BigInt(-initialCollateral));
      expect(ddEURO).to.be.equal(-dec18ToFloat(openingFeedEURO));
      positionContract = await ethers.getContractAt(
        "Position",
        positionAddr,
        owner
      );
      let currentFees = await positionContract.calculateCurrentFee();
      expect(currentFees).to.be.eq(1643);
    });
    it("deny challenge", async () => {
      expect(positionContract.deny([], "")).to.be.emit(
        positionContract,
        "PositionDenied"
      );
    });
    it("should revert denying challenge when challenge started", async () => {
      await evm_increaseTime(86400 * 8);
      await expect(positionContract.deny([], "")).to.be.revertedWithCustomError(
        positionContract,
        "TooLate"
      );
    });
  });
  describe("challenge active", () => {
    it("create position", async () => {
      let collateral = await mockVOL.getAddress();
      let fliqPrice = floatToDec18(5000);
      let minCollateral = floatToDec18(1);
      let fInitialCollateral = floatToDec18(initialCollateral);
      let duration = BigInt(60 * 86_400);
      let fFees = BigInt(fee * 1_000_000);
      let fReserve = BigInt(reserve * 1_000_000);
      let openingFeedEURO = await mintingHub.OPENING_FEE();
      let challengePeriod = BigInt(3 * 86400); // 3 days
      await mockVOL
        .connect(owner)
        .approve(await mintingHub.getAddress(), fInitialCollateral);
      let balBefore = await dEURO.balanceOf(owner.address);
      let balBeforeVOL = await mockVOL.balanceOf(owner.address);
      let tx = await mintingHub.openPositionOneWeek(
        collateral,
        minCollateral,
        fInitialCollateral,
        initialLimit,
        duration,
        challengePeriod,
        fFees,
        fliqPrice,
        fReserve
      );
      let rc = await tx.wait();
      const topic =
        "0x591ede549d7e337ac63249acd2d7849532b0a686377bbf0b0cca6c8abd9552f2"; // PositionOpened
      const log = rc?.logs.find((x) => x.topics.indexOf(topic) >= 0);
      positionAddr = "0x" + log?.topics[2].substring(26);
      let balAfter = await dEURO.balanceOf(owner.address);
      let balAfterVOL = await mockVOL.balanceOf(owner.address);
      let ddEURO = dec18ToFloat(balAfter - balBefore);
      let dVOL = dec18ToFloat(balAfterVOL - balBeforeVOL);
      expect(dVOL).to.be.equal(BigInt(-initialCollateral));
      expect(ddEURO).to.be.equal(-dec18ToFloat(openingFeedEURO));
      positionContract = await ethers.getContractAt(
        "Position",
        positionAddr,
        owner
      );
    });
    it("should revert challenging from non minting hub address", async () => {
      challengeAmount = initialCollateralClone / 2;
      let fchallengeAmount = floatToDec18(challengeAmount);
      await expect(
        positionContract.notifyChallengeStarted(fchallengeAmount)
      ).to.be.revertedWithCustomError(positionContract, "NotHub");
    });
    it("should revert challenging with zero collateral", async () => {
      let price = await positionContract.price();
      await expect(
        mintingHub.challenge(positionAddr, 0, price)
      ).to.be.revertedWithCustomError(positionContract, "ChallengeTooSmall");
    });
    it("should revert challenging for invalid position address", async () => {
      challengeAmount = initialCollateralClone / 2;
      let fchallengeAmount = floatToDec18(challengeAmount);
      let price = await positionContract.price();
      await expect(
        mintingHub.challenge(owner.address, fchallengeAmount, price)
      ).to.be.revertedWithCustomError(mintingHub, "InvalidPos");
    });
    it("should revert challenging with different position price", async () => {
      challengeAmount = initialCollateralClone / 2;
      let fchallengeAmount = floatToDec18(challengeAmount);
      let price = await positionContract.price();
      await expect(
        mintingHub.challenge(positionAddr, fchallengeAmount, price + 100n)
      ).to.be.revertedWithCustomError(mintingHub, "UnexpectedPrice");
    });
    it("should revert challenging zero amount or less than minimal collateral", async () => {
      let price = await positionContract.price();
      await mockVOL.approve(await mintingHub.getAddress(), floatToDec18(0.1));

      await expect(
        mintingHub.challenge(positionAddr, 0, price)
      ).to.be.revertedWithCustomError(positionContract, "ChallengeTooSmall");
      await expect(
        mintingHub.challenge(positionAddr, floatToDec18(0.1), price)
      ).to.be.revertedWithCustomError(positionContract, "ChallengeTooSmall");
    });
    it("bid on challenged, flat sale, not expired position", async () => {
      challengeAmount = initialCollateralClone / 2;
      const fchallengeAmount = floatToDec18(challengeAmount);
      const price = await positionContract.price();
      await mockVOL.approve(await mintingHub.getAddress(), fchallengeAmount);
      let tx = await mintingHub.challenge(
        positionAddr,
        fchallengeAmount,
        price
      );
      challengeNumber++;
      const challenge = await mintingHub.challenges(challengeNumber);
      const challengerAddress = challenge.challenger;
      const challengeData = await positionContract.challengeData(0);

      // Flat sale
      await evm_increaseTime(challengeData.phase1 / 2n);
      let liqPrice = await mintingHub.price(challengeNumber);
      expect(liqPrice).to.be.equal(price);

      const bidSize = floatToDec18(challengeAmount / 4);
      let bidAmountdEURO = (liqPrice * bidSize) / DECIMALS;
      let balanceBeforeBob = await dEURO.balanceOf(bob.address);
      let balanceBeforeChallenger = await dEURO.balanceOf(challengerAddress);
      let volBalanceBefore = await mockVOL.balanceOf(bob.address);

      tx = await mintingHub.connect(bob).bid(challengeNumber, bidSize, false);
      await expect(tx).to.emit(mintingHub, "ChallengeAverted");
      let balanceAfterChallenger = await dEURO.balanceOf(challengerAddress);
      let balanceAfterBob = await dEURO.balanceOf(bob.address);
      let volBalanceAfter = await mockVOL.balanceOf(bob.address);

      expect(volBalanceAfter - volBalanceBefore).to.be.eq(bidSize);
      expect(balanceBeforeBob - balanceAfterBob).to.be.equal(bidAmountdEURO);
      expect(balanceAfterChallenger - balanceBeforeChallenger).to.be.equal(
        bidAmountdEURO
      );

      // Self bidding, should reduce challenge size
      balanceBeforeChallenger = await dEURO.balanceOf(challengerAddress);
      volBalanceBefore = await mockVOL.balanceOf(challengerAddress);

      let updatedChallenge = await mintingHub.challenges(challengeNumber);
      await mintingHub.bid(challengeNumber, updatedChallenge.size, true);

      balanceAfterChallenger = await dEURO.balanceOf(challengerAddress);
      volBalanceAfter = await mockVOL.balanceOf(challengerAddress);
      expect(balanceAfterChallenger).to.be.equal(balanceBeforeChallenger);
    });
    it("bid on challenged, auction sale, not expired position", async () => {
      challengeAmount = initialCollateralClone / 2;
      const fchallengeAmount = floatToDec18(challengeAmount);
      const price = await positionContract.price();
      await mockVOL.connect(charles).approve(await mintingHub.getAddress(), fchallengeAmount);
      await mockVOL.connect(charles).mint(charles.address, fchallengeAmount);
      let tx = await mintingHub.connect(charles).challenge(
        positionAddr,
        fchallengeAmount,
        price
      );
      challengeNumber++;
      const challenge = await mintingHub.challenges(challengeNumber);
      const challengeData = await positionContract.challengeData(0);

      // Auction sale
      await evm_increaseTime(challengeData.phase1 + challengeData.phase2 / 2n);
      let liqPrice = await positionContract.price();
      let auctionPrice = await mintingHub.price(challengeNumber);
      expect(auctionPrice).to.be.approximately(
        liqPrice / 2n,
        auctionPrice / 100n
      );

      const bidSize = floatToDec18(challengeAmount / 4);
      await mockVOL.mint(challenge.position, floatToDec18(challengeAmount / 2));
      let availableCollateral = await mockVOL.balanceOf(challenge.position);
      expect(availableCollateral).to.be.above(bidSize);

      // bob sends a bid
      let bidAmountdEURO = (auctionPrice * bidSize) / DECIMALS;
      let challengerAddress = challenge.challenger;
      await dEURO.transfer(bob.address, bidAmountdEURO);
      let balanceBeforeBob = await dEURO.balanceOf(bob.address);
      let balanceBeforeChallenger = await dEURO.balanceOf(challengerAddress);
      let volBalanceBefore = await mockVOL.balanceOf(bob.address);
      tx = await mintingHub.connect(bob).bid(challengeNumber, bidSize, true);
      await expect(tx)
        .to.emit(mintingHub, "ChallengeSucceeded")
        .emit(dEURO, "Profit");

      let balanceAfterChallenger = await dEURO.balanceOf(challengerAddress);
      let balanceAfterBob = await dEURO.balanceOf(bob.address);
      let volBalanceAfter = await mockVOL.balanceOf(bob.address);
      expect(volBalanceAfter - volBalanceBefore).to.be.eq(bidSize);
      expect(balanceBeforeBob - balanceAfterBob).to.be.approximately(
        bidAmountdEURO,
        bidAmountdEURO / 100n
      );
      expect(
        balanceAfterChallenger - balanceBeforeChallenger
      ).to.be.approximately(bidAmountdEURO / 50n, bidAmountdEURO / 5000n);

      bidAmountdEURO = bidAmountdEURO * 2n;
      await dEURO.transfer(alice.address, bidAmountdEURO);
      await expect(
        mintingHub
          .connect(alice)
          .bid(challengeNumber, challenge.size * 2n, true)
      ).to.be.emit(mintingHub, "PostPonedReturn");
    });
  });
  describe("challenge clone", () => {
    it("should return 0 price when the launch is expired", async () => {
      challengeAmount = initialCollateralClone / 2;
      let fchallengeAmount = floatToDec18(challengeAmount);
      let price = await clonePositionContract.price();
      await mockVOL.approve(await mintingHub.getAddress(), fchallengeAmount);
      let tx = await mintingHub.challenge(
        clonePositionAddr,
        fchallengeAmount,
        price
      );
      await expect(tx).to.emit(mintingHub, "ChallengeStarted");
      challengeNumber++;
      await evm_increaseTime(86400 * 60 * 2);
      expect(await mintingHub.price(challengeNumber)).to.be.eq(0);
    });
    it("send challenge", async () => {
      challengeAmount = initialCollateralClone / 2;
      let fchallengeAmount = floatToDec18(challengeAmount);
      let price = await clonePositionContract.price();
      await mockVOL.approve(await mintingHub.getAddress(), fchallengeAmount);
      let tx = await mintingHub.challenge(
        clonePositionAddr,
        fchallengeAmount,
        price
      );
      await expect(tx).to.emit(mintingHub, "ChallengeStarted");
      challengeNumber++;
      let chprice = await mintingHub.price(challengeNumber);
      expect(chprice).to.be.eq(price);
    });
    it("pos owner cannot withdraw during challenge", async () => {
      let tx = clonePositionContract.withdrawCollateral(
        clonePositionAddr,
        floatToDec18(1)
      );
      await expect(tx).to.be.revertedWithCustomError(
        clonePositionContract,
        "Challenged"
      );
    });
    it("bid on challenged, expired position", async () => {
      // note that the position already has expired at this point in time so challenges will succeed
      let liqPrice = dec18ToFloat(await clonePositionContract.price());
      let bidSize = challengeAmount / 2;
      const challenge = await mintingHub.challenges(challengeNumber);
      let challengerAddress = challenge.challenger;
      let positionsAddress = challenge.position;
      // await mockXEUR.connect(alice).mint(alice.address, floatToDec18(bidSize));

      // console.log("Challenging challenge " + challengeNumber + " at price " + price + " instead of " + liqPrice);
      // Challenging challenge 3 at price 24999903549382556050 instead of 25
      // const timestamp = await time.latest();
      // console.log("Challenge started at " + challenge.start + " on position with start " + (await clonePositionContract.start()) + ", expiration " + (await clonePositionContract.expiration()) + ", challenge period " + (await clonePositionContract.challengePeriod()) + ", and now it is " + timestamp);
      // Challenge started at 1810451265 on position with start 1792911949, expiration 1795503949, challenge period 259200, and now it is 1810451266
      await mockVOL.mint(clonePositionAddr, floatToDec18(bidSize)); // ensure there is something to bid on
      let balanceBeforeAlice = await dEURO.balanceOf(alice.address);
      // console.log("Balance alice " + balanceBeforeAlice + " and bid size " + floatToDec18(bidSize) + " position collateral: " + await mockVOL.balanceOf(clonePositionAddr));
      // let balanceBeforeChallenger = await dEURO.balanceOf(challengerAddress);
      let volBalanceBefore = await mockVOL.balanceOf(alice.address);
      let tx = await mintingHub
        .connect(alice)
        .bid(challengeNumber, floatToDec18(bidSize), false);
      let price = await mintingHub.price(challengeNumber);
      await expect(tx)
        .to.emit(mintingHub, "ChallengeSucceeded")
        .withArgs(
          positionsAddress,
          challengeNumber,
          (floatToDec18(bidSize) * price) / DECIMALS,
          floatToDec18(bidSize),
          floatToDec18(bidSize)
        );
      // let balanceAfterChallenger = await dEURO.balanceOf(challengerAddress);
      // let balanceAfterAlice = await dEURO.balanceOf(alice.address);
      let volBalanceAfter = await mockVOL.balanceOf(alice.address);
      // expect(balanceBeforeAlice - balanceAfterAlice).to.be.eq(bidAmountdEURO);
      // expect(balanceAfterChallenger - balanceBeforeChallenger).to.be.eq(bidAmountdEURO);
      expect(volBalanceAfter - volBalanceBefore).to.be.eq(
        floatToDec18(bidSize)
      );
      await evm_increaseTime(86400);
      // Challenging challenge 3 at price 16666280864197424200 instead of 25
      await expect(
        mintingHub.bid(challengeNumber, floatToDec18(bidSize), false)
      ).to.be.emit(mintingHub, "ChallengeSucceeded");
      expect(await mintingHub.price(challengeNumber)).to.be.eq(0);
    });
    it("bid on not existing challenge", async () => {
      let tx = mintingHub.connect(bob).bid(42, floatToDec18(42), false);
      await expect(tx).to.be.revertedWithPanic();
    });
    it("should revert notify challenge succeed call from non hub", async () => {
      await expect(
        positionContract.notifyChallengeSucceeded(owner.address, 100)
      ).to.be.revertedWithCustomError(positionContract, "NotHub");
    });
    it("should revert notify challenge avert call from non hub", async () => {
      await expect(
        positionContract.notifyChallengeAverted(100)
      ).to.be.revertedWithCustomError(positionContract, "NotHub");
    });
  });
  describe("adjusting price", async () => {
    beforeEach(async () => {
      let collateral = await mockVOL.getAddress();
      let fliqPrice = floatToDec18(5000);
      let minCollateral = floatToDec18(1);
      let fInitialCollateral = floatToDec18(initialCollateral);
      let duration = BigInt(60 * 86_400);
      let fFees = BigInt(fee * 1_000_000);
      let fReserve = BigInt(reserve * 1_000_000);
      let challengePeriod = BigInt(3 * 86400); // 3 days
      await mockVOL
        .connect(owner)
        .approve(await mintingHub.getAddress(), fInitialCollateral);
      let tx = await mintingHub.openPositionOneWeek(
        collateral,
        minCollateral,
        fInitialCollateral,
        initialLimit,
        duration,
        challengePeriod,
        fFees,
        fliqPrice,
        fReserve
      );
      let rc = await tx.wait();
      const topic =
        "0x591ede549d7e337ac63249acd2d7849532b0a686377bbf0b0cca6c8abd9552f2"; // PositionOpened
      const log = rc?.logs.find((x) => x.topics.indexOf(topic) >= 0);
      positionAddr = "0x" + log?.topics[2].substring(26);
      positionContract = await ethers.getContractAt(
        "Position",
        positionAddr,
        owner
      );
    });
    it("should revert adjusting price from non position owner", async () => {
      await expect(
        positionContract.connect(alice).adjustPrice(floatToDec18(1500))
      ).to.be.revertedWithCustomError(positionContract, "NotOwner");
    });
    it("should revert adjusting price when there is pending challenge", async () => {
      challengeAmount = initialCollateralClone / 2;
      let fchallengeAmount = floatToDec18(challengeAmount);
      let price = await positionContract.price();
      await mockVOL.approve(await mintingHub.getAddress(), fchallengeAmount);
      await mintingHub.challenge(positionAddr, fchallengeAmount, price);
      challengeNumber++;
      await expect(
        positionContract.adjustPrice(floatToDec18(1500))
      ).to.be.revertedWithCustomError(positionContract, "Challenged");
    });
    it("should increase cooldown for 3 days when submitted price is greater than the current price", async () => {
      await evm_increaseTime(86400 * 6);
      const prevCooldown = await positionContract.cooldown();
      await expect(positionContract.adjustPrice(floatToDec18(5500))).to.be.emit(
        positionContract,
        "MintingUpdate"
      );
      expect(dec18ToFloat(await positionContract.price())).to.be.equal(5500n);

      const currentCooldown = await positionContract.cooldown();
      expect(currentCooldown > prevCooldown).to.be.true;
    });
    it("should revert adjusting to lower price when it lowers the collateral reserves below minted values", async () => {
      await evm_increaseTime(86400 * 8);
      await positionContract.mint(owner.address, floatToDec18(1000 * 100));

      await expect(
        positionContract.adjustPrice(floatToDec18(100))
      ).to.be.revertedWithCustomError(
        positionContract,
        "InsufficientCollateral"
      );
    });
    it("should revert adjusting price when new price is greater than minimum collateral value", async () => {
      const underPrice = initialLimit;
      await expect(
        positionContract.adjustPrice(underPrice * 2n)
      ).to.be.revertedWithoutReason();
    });
  });

  describe("adjusting position", async () => {
    beforeEach(async () => {
      let collateral = await mockVOL.getAddress();
      let fliqPrice = floatToDec18(5000);
      let minCollateral = floatToDec18(1);
      let fInitialCollateral = floatToDec18(initialCollateral);
      let duration = BigInt(60 * 86_400);
      let fFees = BigInt(fee * 1_000_000);
      let fReserve = BigInt(reserve * 1_000_000);
      let challengePeriod = BigInt(3 * 86400); // 3 days
      await mockVOL
        .connect(owner)
        .approve(await mintingHub.getAddress(), fInitialCollateral);
      let tx = await mintingHub.openPositionOneWeek(
        collateral,
        minCollateral,
        fInitialCollateral,
        initialLimit,
        duration,
        challengePeriod,
        fFees,
        fliqPrice,
        fReserve
      );
      let rc = await tx.wait();
      const topic =
        "0x591ede549d7e337ac63249acd2d7849532b0a686377bbf0b0cca6c8abd9552f2"; // PositionOpened
      const log = rc?.logs.find((x) => x.topics.indexOf(topic) >= 0);
      positionAddr = "0x" + log?.topics[2].substring(26);
      positionContract = await ethers.getContractAt(
        "Position",
        positionAddr,
        owner
      );
    });
    it("should revert adjusting position from non position owner", async () => {
      await expect(
        positionContract.connect(alice).adjust(0, 0, 0)
      ).to.be.revertedWithCustomError(positionContract, "NotOwner");
    });
    it("owner can provide more collaterals to the position", async () => {
      const colBalance = await mockVOL.balanceOf(positionAddr);
      const amount = floatToDec18(100);
      await mockVOL.approve(positionAddr, amount);
      await positionContract.adjust(0, colBalance + amount, floatToDec18(1000));

      const newColBalance = await mockVOL.balanceOf(positionAddr);
      expect(newColBalance - colBalance).to.be.equal(amount);
    });
    it("owner can withdraw collaterals from the position", async () => {
      await evm_increaseTime(86400 * 8);
      const colBalance = await mockVOL.balanceOf(positionAddr);
      const amount = floatToDec18(100);
      await positionContract.adjust(0, colBalance - amount, floatToDec18(1000));

      const newColBalance = await mockVOL.balanceOf(positionAddr);
      expect(colBalance - newColBalance).to.be.equal(amount);
    });
    it("owner can mint new dEURO", async () => {
      await evm_increaseTime(86400 * 8);
      const price = floatToDec18(1000);
      const colBalance = await mockVOL.balanceOf(positionAddr);
      const minted = await positionContract.minted();
      const amount = floatToDec18(100);

      const beforedEUROBal = await dEURO.balanceOf(owner.address);
      await positionContract.adjust(minted + amount, colBalance, price);
      const afterdEUROBal = await dEURO.balanceOf(owner.address);
      expect(afterdEUROBal - beforedEUROBal).to.be.equal(
        ethers.parseEther("89.8384")
      );
    });
    it("owner can burn dEURO", async () => {
      await evm_increaseTime(86400 * 8);
      const price = floatToDec18(1000);
      const colBalance = await mockVOL.balanceOf(positionAddr);
      const minted = await positionContract.minted();
      const amount = floatToDec18(100);
      await positionContract.adjust(minted + amount, colBalance, price);

      await positionContract.adjust(minted, colBalance, price);
      expect(await positionContract.minted()).to.be.equal(minted);
    });
    it("owner can adjust price", async () => {
      await evm_increaseTime(86400 * 8);
      const price = await positionContract.price();
      await positionContract.adjust(0, 0, price * 2n);
      expect(await positionContract.price()).to.be.equal(price * 2n);
    });
  });

  describe("withdrawing collaterals", () => {
    const amount = floatToDec18(10);

    beforeEach(async () => {
      let collateral = await mockVOL.getAddress();
      let fliqPrice = floatToDec18(5000);
      let minCollateral = floatToDec18(1);
      let fInitialCollateral = floatToDec18(initialCollateral);
      let duration = BigInt(60 * 86_400);
      let fFees = BigInt(fee * 1_000_000);
      let fReserve = BigInt(reserve * 1_000_000);
      let challengePeriod = BigInt(3 * 86400); // 3 days
      await mockVOL
        .connect(owner)
        .approve(await mintingHub.getAddress(), fInitialCollateral);
      let tx = await mintingHub.openPositionOneWeek(
        collateral,
        minCollateral,
        fInitialCollateral,
        initialLimit,
        duration,
        challengePeriod,
        fFees,
        fliqPrice,
        fReserve
      );
      let rc = await tx.wait();
      const topic =
        "0x591ede549d7e337ac63249acd2d7849532b0a686377bbf0b0cca6c8abd9552f2"; // PositionOpened
      const log = rc?.logs.find((x) => x.topics.indexOf(topic) >= 0);
      positionAddr = "0x" + log?.topics[2].substring(26);
      positionContract = await ethers.getContractAt(
        "Position",
        positionAddr,
        owner
      );
      await mockVOL.transfer(positionAddr, amount);
    });
    it("should revert withdrawing collaterals from non position owner", async () => {
      await expect(
        positionContract
          .connect(alice)
          .withdrawCollateral(owner.address, amount)
      ).to.be.revertedWithCustomError(positionContract, "NotOwner");
    });
    it("should revert withdrawing when it is in hot auctions", async () => {
      await expect(
        positionContract.withdrawCollateral(owner.address, amount)
      ).to.be.revertedWithCustomError(positionContract, "Hot");
    });
    it("should revert when withdrawing portion of collaterals leaving dust", async () => {
      await positionContract.deny([], "");
      const balance = await mockVOL.balanceOf(positionAddr);
      await expect(
        positionContract.withdrawCollateral(
          owner.address,
          balance - ethers.parseEther("0.5")
        )
      ).to.be.revertedWithCustomError(
        positionContract,
        "InsufficientCollateral"
      );
    });
    it("owner should be able to withdraw collaterals after the auction is closed", async () => {
      await positionContract.deny([], "");
      const colBal = await mockVOL.balanceOf(positionAddr);
      expect(
        positionContract.withdrawCollateral(owner.address, colBal)
      ).to.be.emit(positionContract, "MintingUpdate");
      expect(positionContract.withdrawCollateral(owner.address, 0)).to.be.emit(
        positionContract,
        "MintingUpdate"
      );
    });
  });
  describe("withdrawing any tokens", () => {
    it("should revert withdrawing tokens from non position owner", async () => {
      const amount = floatToDec18(1);
      await expect(
        positionContract
          .connect(alice)
          .withdraw(await dEURO.getAddress(), owner.address, amount)
      ).to.be.revertedWithCustomError(positionContract, "NotOwner");
    });
    it("owner can withdraw any erc20 tokens locked on position contract", async () => {
      await evm_increaseTime(86400 * 8);
      const amount = floatToDec18(1);

      await dEURO.transfer(positionAddr, amount);
      const beforeBal = await dEURO.balanceOf(positionAddr);
      await positionContract.withdraw(
        await dEURO.getAddress(),
        owner.address,
        amount
      );
      const afterBal = await dEURO.balanceOf(positionAddr);
      expect(beforeBal - afterBal).to.be.equal(amount);

      // withdraw collaterals
      await mockVOL.transfer(positionAddr, amount);
      const beforeColBal = await mockVOL.balanceOf(positionAddr);
      await positionContract.withdraw(
        await mockVOL.getAddress(),
        owner.address,
        amount
      );
      const afterColBal = await mockVOL.balanceOf(positionAddr);
      expect(beforeColBal - afterColBal).to.be.equal(amount);
    });
  });
  describe("returning postponed collateral", async () => {
    it("should return pending postponed collaterals (Need to find more exact scenarios)", async () => {
      await mintingHub.returnPostponedCollateral(
        await mockVOL.getAddress(),
        owner.address
      );
    });
  });
  describe("notifying loss", async () => {
    const amount = floatToDec18(10);
    const initialLimit = floatToDec18(1_000_000);
    let fliqPrice = floatToDec18(5000);
    let minCollateral = floatToDec18(1);
    let fInitialCollateral = floatToDec18(initialCollateral);
    let fchallengeAmount = floatToDec18(initialCollateral);
    let duration = BigInt(60 * 86_400);
    let fFees = BigInt(fee * 1_000_000);
    let fReserve = BigInt(reserve * 1_000_000);
    let challengePeriod = BigInt(3 * 86400); // 3 days

    beforeEach(async () => {
      let collateral = await mockVOL.getAddress();
      await mockVOL
        .connect(owner)
        .approve(await mintingHub.getAddress(), fInitialCollateral);
      let tx = await mintingHub.openPositionOneWeek(
        collateral,
        minCollateral,
        fInitialCollateral,
        initialLimit,
        duration,
        challengePeriod,
        fFees,
        fliqPrice,
        fReserve
      );
      let rc = await tx.wait();
      let topic =
        "0x591ede549d7e337ac63249acd2d7849532b0a686377bbf0b0cca6c8abd9552f2"; // PositionOpened
      let log = rc?.logs.find((x) => x.topics.indexOf(topic) >= 0);
      positionAddr = "0x" + log?.topics[2].substring(26);
      positionContract = await ethers.getContractAt(
        "Position",
        positionAddr,
        owner
      );
      await mockVOL.transfer(positionAddr, amount);

      await evm_increaseTime(86400 * 7);
      await mockVOL.approve(await mintingHub.getAddress(), initialLimit);
      const cloneLimit = await positionContract.limitForClones();
      tx = await mintingHub.clone(
        positionAddr,
        fInitialCollateral,
        cloneLimit,
        duration
      );
      rc = await tx.wait();
      log = rc?.logs.find((x) => x.topics.indexOf(topic) >= 0);
      clonePositionAddr = "0x" + log?.topics[2].substring(26);
      clonePositionContract = await ethers.getContractAt(
        "Position",
        clonePositionAddr,
        alice
      );

      let price = await clonePositionContract.price();
      await mockVOL.approve(await mintingHub.getAddress(), fchallengeAmount);
      await mintingHub.challenge(clonePositionAddr, fchallengeAmount, price);
      challengeNumber++;
    });
    it("should transfer loss amount from reserve to minting hub when notify loss", async () => {
      await evm_increaseTime(86400 * 6);
      await dEURO.transfer(await equity.getAddress(), floatToDec18(400_000));
      let tx = await mintingHub
        .connect(bob)
        .bid(challengeNumber, fchallengeAmount, false);
      await expect(tx)
        .to.emit(mintingHub, "ChallengeSucceeded")
        .emit(dEURO, "Loss");
    });
    it("should transfer loss amount from reserve to minting hub when notify loss", async () => {
      await evm_increaseTime(86400 * 6);
      let tx = await mintingHub
        .connect(bob)
        .bid(challengeNumber, fchallengeAmount, false);
      await expect(tx)
        .to.emit(mintingHub, "ChallengeSucceeded")
        .emit(dEURO, "Loss");
    });
  });

  /* describe("native position test", () => {

        let mintingHubTest: MintingHubTest;

        it("initialize", async () => {
            let nDEPSSupply = await equity.totalSupply();
            mintingHubTest = await createContract("MintingHubTest", [await mintingHub.getAddress(), bridge.address]);
            await mintingHubTest.initiateEquity();
            await mintingHubTest.initiatePosition();
        });

        it("deny position", async () => {
            await mintingHubTest.initiateAndDenyPosition();
        });

        it("fails when minting too early", async () => {
            let tx = mintingHubTest.letAliceMint();
            await expect(tx).to.be.reverted;
        });

        it("allows minting after 2 days", async () => {
            await evm_increaseTime(7 * 86_400 + 60);
            await mintingHubTest.letAliceMint();
        });

        it("supports withdrawals", async () => {
            await mintingHubTest.testWithdraw();
        });

        it("fails when someone else mints", async () => {
            let tx = mintingHubTest.letBobMint();
            await expect(tx).to.be.reverted;
        });

        it("perform challenge", async () => {
            await mintingHubTest.letBobChallengePart1();
            await evm_mine_blocks(1);
            await mintingHubTest.letBobChallengePart2();
            let tx = mintingHubTest.endChallenges();
            await expect(tx).to.be.revertedWith('period has not ended');

            await evm_increaseTime(1 * 86_400 + 60);
            await mintingHubTest.endChallenges();
        });

        it("excessive challenge", async () => {
            await mintingHubTest.testExcessiveChallengePart1();
            await evm_mine_blocks(1)
            await mintingHubTest.testExcessiveChallengePart2();
        });

        it("restructuring", async () => {
            await mintingHubTest.restructure();
        });

        it("challenge expired position", async () => {
            await evm_increaseTime(100 * 86_400);
            await mintingHubTest.challengeExpiredPosition();

            await evm_increaseTime(86_400 - 10);// 10 seconds before end 
            await mintingHubTest.bidNearEndOfChallenge();

            await evm_increaseTime(20);
            let tx = mintingHubTest.endLastChallenge();
            await expect(tx).to.be.revertedWith("period has not ended");

            await evm_increaseTime(30 * 60);
            await mintingHubTest.endLastChallenge();
        });
    }); */
});
