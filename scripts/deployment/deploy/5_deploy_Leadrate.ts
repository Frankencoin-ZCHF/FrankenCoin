import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../deployUtils";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { get },
    ethers,
  } = hre;

  const paramFile = "paramsLeadrate.json";
  let chainId = hre.network.config["chainId"];
  let paramsArr = require(__dirname + `/../parameters/${paramFile}`);

  // find config for current chain
  for (var k = 0; k < paramsArr.length && paramsArr[k].chainId != chainId; k++);
  let params = paramsArr[k];
  if (chainId != params.chainId) {
    throw new Error("ChainId doesn't match");
  }
  const zchfDeployment = await get("Frankencoin");
  let zchfContract = await ethers.getContractAt(
    "Frankencoin",
    zchfDeployment.address
  );
  let equity = await zchfContract.reserve();

  let initialRate = params["initialRatePPM"];
  console.log(`\nInitial lead reate in PPM = ${initialRate}`);

  let leadrateContract = await deployContract(hre, "Leadrate", [
    equity,
    initialRate,
  ]);

  console.log(`Verify mintingHubContract:
    npx hardhat verify --network ${hre.network.name} ${await leadrateContract.getAddress()} ${equity} ${initialRate}
    `);
};

export default deploy;
deploy.tags = ["main", "PositionRoller"];
