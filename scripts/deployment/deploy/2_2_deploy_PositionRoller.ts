import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../deployUtils";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { get },
  } = hre;

  const dEURODeploydeumentAddress = "0xd45e911843721083A2751fA9Cc9D2a8089D8C0f5";
  await deployContract(hre, "PositionRoller", [dEURODeploydeumentAddress]);
 
  const positionRollerDeployment = await get("PositionRoller");
  console.log(
    `Verify Leadrate:\nnpx hardhat verify --network sepolia ${positionRollerDeployment.address} ${dEURODeploydeumentAddress}`
  );
};
export default deploy;
deploy.tags = ["main", "PositionRoller"];
