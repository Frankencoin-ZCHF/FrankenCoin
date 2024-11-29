import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../deployUtils";
import { verify } from "../../verify";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const deployment = await deployContract(hre, "PositionFactory");

  const deploymentAddress = await deployment.getAddress();

  if(hre.network.name === "mainnet" && process.env.ETHERSCAN_API_KEY){
    await verify(deploymentAddress, []);
  } else {
    console.log(
      `Verify:\nnpx hardhat verify --network ${hre.network.name} ${deploymentAddress}}`
    );
  }
};
export default deploy;
deploy.tags = ["main", "PositionFactory"];
