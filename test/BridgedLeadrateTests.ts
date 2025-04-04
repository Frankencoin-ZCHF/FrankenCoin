import { ethers } from "hardhat";
import { CCIPLocalSimulator } from "../typechain";
import {
  impersonateAccount,
  loadFixture,
  setBalance,
  stopImpersonatingAccount,
} from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

describe("BridgedLeadrate", () => {
  async function deployFixture() {
    const [owner, leadreateMock, singleVoter] = await ethers.getSigners();

    const ccipLocalSimualtorFactory = await ethers.getContractFactory(
      "CCIPLocalSimulator"
    );
    const ccipLocalSimulator: CCIPLocalSimulator =
      await ccipLocalSimualtorFactory.deploy();
    const ccipLocalSimulatorConfig = await ccipLocalSimulator.configuration();

    const bridgedLeadrateFactory = await ethers.getContractFactory(
      "BridgedLeadrate"
    );
    const bridgedLeadrate = await bridgedLeadrateFactory.deploy(
      ccipLocalSimulatorConfig.destinationRouter_,
      5,
      ccipLocalSimulatorConfig.chainSelector_,
      await leadreateMock.getAddress()
    );

    await setBalance(
      ccipLocalSimulatorConfig.destinationRouter_,
      ethers.parseEther("10.0")
    );

    return {
      ccipLocalSimulatorConfig,
      owner,
      bridgedLeadrate,
      leadreateMock,
      singleVoter,
    };
  }

  it("should validate the source chain", async () => {
    const { owner, bridgedLeadrate, ccipLocalSimulatorConfig } =
      await loadFixture(deployFixture);
    const abicoder = ethers.AbiCoder.defaultAbiCoder();

    await impersonateAccount(ccipLocalSimulatorConfig.destinationRouter_);
    const routerSigner = await ethers.getSigner(
      ccipLocalSimulatorConfig.destinationRouter_
    );
    await expect(
      bridgedLeadrate.connect(routerSigner).ccipReceive({
        messageId:
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        sourceChainSelector: "123456",
        sender: abicoder.encode(["address"], [await owner.getAddress()]),
        data: abicoder.encode(["uint64"], [50]),
        destTokenAmounts: [],
      })
    ).revertedWithCustomError(bridgedLeadrate, "InvalidSourceChain");

    await stopImpersonatingAccount(ccipLocalSimulatorConfig.destinationRouter_);
  });

  it("should validate the sender", async () => {
    const { owner, bridgedLeadrate, ccipLocalSimulatorConfig } =
      await loadFixture(deployFixture);
    const abicoder = ethers.AbiCoder.defaultAbiCoder();

    await impersonateAccount(ccipLocalSimulatorConfig.destinationRouter_);
    const routerSigner = await ethers.getSigner(
      ccipLocalSimulatorConfig.destinationRouter_
    );
    await expect(
      bridgedLeadrate.connect(routerSigner).ccipReceive({
        messageId:
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        sourceChainSelector: ccipLocalSimulatorConfig.chainSelector_,
        sender: abicoder.encode(["address"], [await owner.getAddress()]),
        data: abicoder.encode(["uint64"], [50]),
        destTokenAmounts: [],
      })
    ).revertedWithCustomError(bridgedLeadrate, "InvalidSender");

    await stopImpersonatingAccount(ccipLocalSimulatorConfig.destinationRouter_);
  });

  it("should update the rate", async () => {
    const { owner, bridgedLeadrate, ccipLocalSimulatorConfig, leadreateMock } =
      await loadFixture(deployFixture);
    const abicoder = ethers.AbiCoder.defaultAbiCoder();
    expect(await bridgedLeadrate.currentRatePPM()).to.not.equal(50);

    await impersonateAccount(ccipLocalSimulatorConfig.destinationRouter_);
    const routerSigner = await ethers.getSigner(
      ccipLocalSimulatorConfig.destinationRouter_
    );
    await bridgedLeadrate.connect(routerSigner).ccipReceive({
      messageId:
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      sourceChainSelector: ccipLocalSimulatorConfig.chainSelector_,
      sender: abicoder.encode(["address"], [await leadreateMock.getAddress()]),
      data: abicoder.encode(["uint64"], [50]),
      destTokenAmounts: [],
    });
    expect(await bridgedLeadrate.currentRatePPM()).to.equal(50);

    await stopImpersonatingAccount(ccipLocalSimulatorConfig.destinationRouter_);
  });
});
