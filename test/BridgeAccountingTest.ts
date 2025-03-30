import { ethers } from "hardhat";
import { CCIPLocalSimulator } from "../typechain";
import {
  impersonateAccount,
  loadFixture,
  setBalance,
  stopImpersonatingAccount,
} from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

describe("BridgeAccounting", () => {
  async function deployFixture() {
    const [owner, remoteFrankencoin, remotePool] = await ethers.getSigners();

    const ccipLocalSimualtorFactory = await ethers.getContractFactory(
      "CCIPLocalSimulator"
    );
    const ccipLocalSimulator: CCIPLocalSimulator =
      await ccipLocalSimualtorFactory.deploy();
    const ccipLocalSimulatorConfig = await ccipLocalSimulator.configuration();

    const frankencoinFactory = await ethers.getContractFactory("Frankencoin");
    const frankencoin = await frankencoinFactory.deploy(0);

    const tokenAdminRegistryFactory = await ethers.getContractFactory(
      "TokenAdminRegistry"
    );
    const tokenAdminRegistry = await tokenAdminRegistryFactory.deploy();

    const bridgeAccountingFactory = await ethers.getContractFactory(
      "BridgeAccounting"
    );
    const bridgeAccounting = await bridgeAccountingFactory.deploy(
      await frankencoin.getAddress(),
      await tokenAdminRegistry.getAddress(),
      ccipLocalSimulatorConfig.destinationRouter_
    );

    const tokenPoolFactory = await ethers.getContractFactory(
      "BurnMintTokenPool"
    );
    const tokenPool = await tokenPoolFactory.deploy(
      await frankencoin.getAddress(),
      18,
      [],
      await owner.getAddress(),
      ccipLocalSimulatorConfig.destinationRouter_
    );

    await tokenAdminRegistry.proposeAdministrator(
      await frankencoin.getAddress(),
      owner.address
    );
    await tokenAdminRegistry.acceptAdminRole(await frankencoin.getAddress());
    await tokenAdminRegistry.setPool(
      await frankencoin.getAddress(),
      await tokenPool.getAddress()
    );
    await frankencoin.initialize(
      await bridgeAccounting.getAddress(),
      "BridgeAccounting"
    );
    await frankencoin.initialize(await owner.getAddress(), "Owner");
    await tokenPool.applyChainUpdates(
      [],
      [
        {
          inboundRateLimiterConfig: {
            capacity: 0,
            rate: 0,
            isEnabled: false,
          },
          outboundRateLimiterConfig: {
            capacity: 0,
            rate: 0,
            isEnabled: false,
          },
          remoteChainSelector: ccipLocalSimulatorConfig.chainSelector_,
          remoteTokenAddress: ethers.AbiCoder.defaultAbiCoder().encode(
            ["address"],
            [await remoteFrankencoin.getAddress()]
          ),
          remotePoolAddresses: [
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["address"],
              [await remotePool.getAddress()]
            ),
          ],
        },
      ]
    );

    await setBalance(
      ccipLocalSimulatorConfig.destinationRouter_,
      ethers.parseEther("10.0")
    );

    return {
      frankencoin,
      tokenAdminRegistry,
      bridgeAccounting,
      ccipLocalSimulatorConfig,
      tokenPool,
      remotePool,
      remoteFrankencoin,
      owner,
    };
  }

  it("should validate the sender", async () => {
    const { owner, bridgeAccounting, ccipLocalSimulatorConfig } =
      await loadFixture(deployFixture);
    const abicoder = ethers.AbiCoder.defaultAbiCoder();

    await impersonateAccount(ccipLocalSimulatorConfig.destinationRouter_);
    const routerSigner = await ethers.getSigner(
      ccipLocalSimulatorConfig.destinationRouter_
    );
    await expect(
      bridgeAccounting.connect(routerSigner).ccipReceive({
        messageId:
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        sourceChainSelector: ccipLocalSimulatorConfig.chainSelector_,
        sender: abicoder.encode(["address"], [await owner.getAddress()]),
        data: abicoder.encode(["uint256", "uint256"], [0, 0]),
        destTokenAmounts: [],
      })
    ).revertedWithCustomError(bridgeAccounting, "InvalidSender");
    await stopImpersonatingAccount(ccipLocalSimulatorConfig.destinationRouter_);
  });

  it("should handle profits", async () => {
    const {
      bridgeAccounting,
      ccipLocalSimulatorConfig,
      remoteFrankencoin,
      frankencoin,
    } = await loadFixture(deployFixture);
    const abicoder = ethers.AbiCoder.defaultAbiCoder();
    await frankencoin.mint(
      await bridgeAccounting.getAddress(),
      ethers.parseEther("10.0")
    );
    await impersonateAccount(ccipLocalSimulatorConfig.destinationRouter_);
    const routerSigner = await ethers.getSigner(
      ccipLocalSimulatorConfig.destinationRouter_
    );
    await expect(
      bridgeAccounting.connect(routerSigner).ccipReceive({
        messageId:
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        sourceChainSelector: ccipLocalSimulatorConfig.chainSelector_,
        sender: abicoder.encode(
          ["address"],
          [await remoteFrankencoin.getAddress()]
        ),
        data: abicoder.encode(["uint256", "uint256"], [50, 0]),
        destTokenAmounts: [],
      })
    )
      .to.emit(bridgeAccounting, "ReceivedProfits")
      .withArgs(ethers.parseEther("10.0"))
      .emit(frankencoin, "Profit")
      .withArgs(
        await bridgeAccounting.getAddress(),
        ethers.parseEther("10.0")
      );
    await stopImpersonatingAccount(ccipLocalSimulatorConfig.destinationRouter_);
  });

  it("should handle losses", async () => {
    const {
      bridgeAccounting,
      ccipLocalSimulatorConfig,
      remoteFrankencoin,
      frankencoin,
    } = await loadFixture(deployFixture);
    const abicoder = ethers.AbiCoder.defaultAbiCoder();
    await frankencoin.mint(
      await bridgeAccounting.getAddress(),
      ethers.parseEther("10.0")
    );
    await impersonateAccount(ccipLocalSimulatorConfig.destinationRouter_);
    const routerSigner = await ethers.getSigner(
      ccipLocalSimulatorConfig.destinationRouter_
    );
    await expect(
      bridgeAccounting.connect(routerSigner).ccipReceive({
        messageId:
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        sourceChainSelector: ccipLocalSimulatorConfig.chainSelector_,
        sender: abicoder.encode(
          ["address"],
          [await remoteFrankencoin.getAddress()]
        ),
        data: abicoder.encode(["uint256", "uint256"], [0, 50]),
        destTokenAmounts: [],
      })
    )
      .to.emit(bridgeAccounting, "ReceivedLosses")
      .withArgs(50)
      .emit(frankencoin, "Loss")
      .withArgs(await bridgeAccounting.getAddress(), 50)
      .emit(frankencoin, "Transfer")
      .withArgs(await bridgeAccounting.getAddress(), ethers.ZeroAddress, 50);
    await stopImpersonatingAccount(ccipLocalSimulatorConfig.destinationRouter_);
  });
});
