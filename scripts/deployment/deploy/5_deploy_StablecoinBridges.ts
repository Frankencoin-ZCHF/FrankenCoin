import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../deployUtils";
import { floatToDec18 } from "../../math";

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
  let otherToken, otherAddress, limit, weeks, applicationMsg;
  const { deployments: { get }, run } = hre;

  const paramFile = __dirname + "/../parameters/paramsBridges.json";
  let paramsArr = require(paramFile);

  for (let i = 1; i < paramsArr.length; i++) {
    if (["hardhat", "localhost", "sepolia"].includes(hre.network.name)) {
      try {
        const mockTokenDeployment = await get("TestToken");
        otherAddress = mockTokenDeployment.address;
      } catch (err: unknown) {
        otherAddress = await getAddress();
        if (otherAddress == "") {
          throw err;
        }
      }

      otherToken = "MockXEUR";
      limit = 5_000;
      weeks = 30;
      applicationMsg = "MockXEUR Token Bridge"
    } else {
      otherToken = paramsArr[i].name;
      otherAddress = paramsArr[i].other;
      limit = paramsArr[i].limit;
      weeks = paramsArr[i].weeks;
      applicationMsg = paramsArr[i].applicationMsg;
    }
    
    console.log(`\nDeploying ${otherToken} StablecoinBridge with other = ${otherAddress}, limit = ${limit} EUR and weeks = ${weeks}`);

    // const dEURODeployment = await get("DecentralizedEURO");
    const dEURODeploydeumentAddress = "0xd45e911843721083A2751fA9Cc9D2a8089D8C0f5";
    let dLimit = floatToDec18(limit);
    
    await deployContract(hre, "StablecoinBridge", [
      otherAddress,
      dEURODeploydeumentAddress,
      dLimit,
      weeks,
    ]);

    const bridgeDeployment = await get("StablecoinBridge");
    let bridgeAddr: string = bridgeDeployment.address;

    if (!["hardhat", "localhost"].includes(hre.network.name)) {
      console.log(
        `Verify StablecoinBridge: npx hardhat verify --network ${hre.network.name} ${bridgeAddr} ${otherAddress} ${dEURODeploydeumentAddress} ${dLimit} ${weeks}`
      );
      
      // Automate verification
      // console.log("Verifying contract on Etherscan...");
      // try {
      //   await run("verify:verify", {
      //     address: bridgeAddr,
      //     constructorArguments: [otherAddress, dEURODeployment.address, dLimit, weeks],
      //   });
      //   console.log("Contract verified successfully!");
      // } catch (err) {
      //   console.error("Verification failed:", err);
      // }
    }
  }
};

export default deploy;
deploy.tags = ["main", "StablecoinBridge"];
