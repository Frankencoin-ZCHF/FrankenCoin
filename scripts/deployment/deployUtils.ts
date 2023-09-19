import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Contract } from "ethers";

export const deployContract = async (
  hre: HardhatRuntimeEnvironment,
  contractName: string,
  args?: any[]
): Promise<Contract> => {
  const {
    deployments: { deploy, log, get },
    getNamedAccounts,
    ethers,
  } = hre;

  const { deployer } = await getNamedAccounts();

  const deployment = await deploy(contractName, {
    from: deployer,
    args: args,
    log: true,
  });
  return await ethers.getContractAt(contractName, deployment.address);
};

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
