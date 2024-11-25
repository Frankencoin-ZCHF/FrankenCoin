import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { writeFileSync } from "fs";
import { deployContract } from "../deployUtils";
/*
    deploy mock-tokens specified in paramsPosition.json
    - also writes the address of the deployed token into the config file
    - hence, to add a new token, token address in paramsPosition.json can be ''
*/
const deployMockTokens: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const paramFile = "paramsPositions.json";

  let chainId = hre.network.config["chainId"];

  // write address to config
  const filename = __dirname + `/../parameters/${paramFile}`;
  let paramsArr = require(filename);
  // find config for current chain
  for (var k = 0; k < paramsArr.length; k++) {
    if (paramsArr[k].chainId == chainId && paramsArr[k].type == "mock") {
      // deploy
      const contractName = paramsArr[k].name;
      let mockVOLTokenContract = await deployContract(hre, contractName);
      const decimals = await mockVOLTokenContract.decimals();

      console.log(
        `Mocktoken ${contractName}(${decimals}) deployed at ${mockVOLTokenContract.address}\n`
      );
      // store address to params
      paramsArr[k].collateralTknAddr = mockVOLTokenContract.target;
    }
  }
  // write param-file
  writeFileSync(filename, JSON.stringify(paramsArr, null, 2), { flag: "w" });
};
deployMockTokens.tags = ["MockTokens"];
export default deployMockTokens;
