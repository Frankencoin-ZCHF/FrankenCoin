import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../deployUtils";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { get },
  } = hre;

  const equityDeploymentAddress = "0xC92aF56C354FCF641f4567a04fd7032013E8A314";
  await deployContract(hre, "Leadrate", [equityDeploymentAddress, 5]);
 
  const leadrateDeployment = await get("Leadrate");
  console.log(
    `Verify Leadrate:\nnpx hardhat verify --network sepolia ${leadrateDeployment.address} ${equityDeploymentAddress} 5`
  );
};
export default deploy;
deploy.tags = ["main", "Leadrate"];
