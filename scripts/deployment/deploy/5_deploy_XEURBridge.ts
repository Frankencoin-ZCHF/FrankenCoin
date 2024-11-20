import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract, sleep } from "../deployUtils";
import { floatToDec18 } from "../../math";
import { StablecoinBridge } from "../../../typechain";
var prompt = require("prompt");

async function getAddress() {
  // local node address
  let addr = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";

  console.log("Is this address for MOCKEUR ok? [y,N]", addr);
  prompt.start();
  const { isOk } = await prompt.get(["isOk"]);
  if (isOk != "y" && isOk != "Y") {
    return "";
  }
  return addr;
}

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const limit = 10_000_000;
  const {
    deployments: { get },
    ethers,
  } = hre;
  let xeurAddress;
  let applicationMsg;
  if (["hardhat", "localhost", "sepolia"].includes(hre.network.name)) {
    console.log("Setting Mock-XEUR-Token Bridge");
    try {
      const xeurDeployment = await get("TestToken");
      xeurAddress = xeurDeployment.address;
    } catch (err: unknown) {
      xeurAddress = await getAddress();
      if (xeurAddress == "") {
        throw err;
      }
    }

    applicationMsg = "MockXEUR Token Bridge";
  } else {
    console.log("Deploying XEUR-Token Bridge");
    xeurAddress = "0xb4272071ecadd69d933adcd19ca99fe80664fc08";
    applicationMsg = "XEUR Bridge";
  }
  const dEURODeployment = await get("EuroCoin");
  let dEUROContract = await ethers.getContractAt(
    "EuroCoin",
    dEURODeployment.address
  );

  let dLimit = floatToDec18(limit);
  console.log("\nDeploying StablecoinBridge with limit = ", limit, "EUR");
  await deployContract(hre, "StablecoinBridge", [
    xeurAddress,
    dEURODeployment.address,
    dLimit,
  ]);

  // suggest minter
  const bridgeDeployment = await get("StablecoinBridge");
  let bridgeAddr: string = bridgeDeployment.address;

  console.log(
    `Verify StablecoinBridge:\nnpx hardhat verify --network sepolia ${bridgeAddr} ${xeurAddress} ${dEURODeployment.address} ${dLimit}\n`
  );

  let isAlreadyMinter = await dEUROContract.isMinter(bridgeAddr);
  if (isAlreadyMinter) {
    console.log(bridgeDeployment.address, "already is a minter");
  } else {
    let msg = "XEUR Bridge";
    console.log(
      "Apply for the bridge ",
      bridgeDeployment.address,
      "to be minter via dEURO.suggestMinter"
    );
    let tx = await dEUROContract.initialize(bridgeDeployment.address, msg);
    console.log("tx hash = ", tx.hash);
    await tx.wait();
    let isMinter = false;
    let trial = 0;
    while (!isMinter && trial < 5) {
      console.log("Waiting 20s...");
      await sleep(20 * 1000);
      isMinter = await dEUROContract.isMinter(bridgeAddr, {
        gasLimit: 1_000_000,
      });
      console.log("Is minter? ", isMinter);
      trial += 1;
    }
  }

  if (["hardhat", "localhost", "sepolia"].includes(hre.network.name)) {
    let amount = floatToDec18(20_000);
    const mockXEUR = await ethers.getContractAt("TestToken", xeurAddress);
    await mockXEUR.approve(bridgeAddr, amount);
    const bridge = await ethers.getContractAt("StablecoinBridge", bridgeAddr);
    await bridge.mint(amount);
  }
};
export default deploy;
deploy.tags = ["main", "XEURBridge"];
