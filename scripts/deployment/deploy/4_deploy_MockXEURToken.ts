import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../deployUtils";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (["hardhat", "localhost", "sepolia"].includes(hre.network.name)) {
    await deployContract(hre, "TestToken", ["CryptoFranc", "XEUR", 18]);
  }
};

export default deploy;
deploy.tags = ["MockTokens", "MockEURToken"];
