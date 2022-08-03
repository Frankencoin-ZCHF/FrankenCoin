import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {deployContract} from "../deployUtils";


const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  await deployContract(hre, "Multicall");
  const {
    deployments: { get },
  } = hre;
  const mc = await get("Multicall");
  console.log("Multicall deployed at", mc.address);
};
export default deploy;
