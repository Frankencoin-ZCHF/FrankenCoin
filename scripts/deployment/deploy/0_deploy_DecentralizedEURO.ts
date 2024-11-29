import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../deployUtils";
import { verify } from "../../verify";
import { getParams } from "../../utils";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const chainId = hre.network.config["chainId"];
  if (chainId === undefined) {
    throw new Error("Chain ID is undefined");
  }

  const params = getParams("paramsDecentralizedEURO", chainId);

  const minApplicationPeriod = params.minApplicationPeriod;

  const args = [minApplicationPeriod];

  const deployment = await deployContract(hre, "DecentralizedEURO", args);
  
  const deploymentAddress = await deployment.getAddress();
  const reserveAddress = await deployment.reserve();

  if(hre.network.name === "mainnet" && process.env.ETHERSCAN_API_KEY){
    await verify(deploymentAddress, args);
    await verify(reserveAddress, [deploymentAddress]);
  } else {
    console.log(`Verify:\nnpx hardhat verify --network ${hre.network.name} ${deploymentAddress} ${args.join(" ")}\n`);
    console.log(`Verify:\nnpx hardhat verify --network ${hre.network.name} ${reserveAddress} ${deploymentAddress}\n`);
  }

  console.log("-------------------------------------------------------------------");
};

export default deploy;
deploy.tags = ["main", "DecentralizedEURO"];
