import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../deployUtils";
import { getParams } from "../../utils";
import { verify } from "../../verify";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const chainId = hre.network.config["chainId"];
  if (chainId === undefined) {
    throw new Error("Chain ID is undefined");
  }

  const params = getParams("paramsSavings", chainId);

  const decentralizedEURO = params.decentralizedEURO;
  const initialRatePPM = params.initialRatePPM;

  const args = [decentralizedEURO, initialRatePPM];
  
  const deployment = await deployContract(hre, "Savings", args);

  const deploymentAddress = await deployment.getAddress();

  if(hre.network.name === "mainnet" && process.env.ETHERSCAN_API_KEY){
    await verify(deploymentAddress, args);
  } else {
    console.log(
      `Verify:\nnpx hardhat verify --network ${hre.network.name} ${deploymentAddress} ${args.join(" ")}`
    );
  }

  console.log("-------------------------------------------------------------------");
};
export default deploy;
deploy.tags = ["main", "Savings"];
