import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Contract } from "ethers";

export const deployContract = async (
  hre: HardhatRuntimeEnvironment,
  contractName: string,
  args?: any[],
  verbose = true
): Promise<Contract> => {
  const {
    deployments: { deploy, log },
    getNamedAccounts,
    ethers,
  } = hre;

  const { deployer } = await getNamedAccounts();

  const deployment = await deploy(contractName, {
    from: deployer,
    args: args,
    log: true,
  });


  if (verbose) {
    log(`Contract ${contractName} deployed to: ${deployment.address} with args: ${args}`);
  }

  return ethers.getContractAt(contractName, deployment.address);
};