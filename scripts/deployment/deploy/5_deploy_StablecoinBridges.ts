import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../deployUtils";
import { floatToDec18 } from "../../math";
import { getParams } from "../../utils";
import { verify } from "../../verify";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const chainId = hre.network.config["chainId"];
  if (chainId === undefined) {
    throw new Error("Chain ID is undefined");
  }

  const params = getParams("paramsSavings", chainId);
  const bridges = params.bridges;

  for (let i = 1; i < bridges.length; i++) {
    const bridge = bridges[i];

    const otherAddress = bridge.other;
    const decentralizedEURO = bridge.decentralizedEURO;
    const limit = floatToDec18(bridge.limit);
    const weeks = bridge.weeks;

    const args = [otherAddress, decentralizedEURO, limit, weeks];
    
    const deployment = await deployContract(hre, "StablecoinBridge", args);

    const deploymentAddress = await deployment.getAddress();

    if(hre.network.name === "mainnet" && process.env.ETHERSCAN_API_KEY){
      await verify(deploymentAddress, args);
    } else {
      console.log(
        `Verify:\nnpx hardhat verify --network ${hre.network.name} ${deploymentAddress} ${args.join(" ")}`
      );
    }

    console.log("-------------------------------------------------------------------");
  }
};

export default deploy;
deploy.tags = ["main", "StablecoinBridge"];
