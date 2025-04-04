import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../deployUtils";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { get },
    ethers,
  } = hre;
  const paramFile = "paramsCCIP.json";
  let chainId = hre.network.config["chainId"];
  let paramsArr = require(__dirname + `/../parameters/${paramFile}`);
  // find config for current chain
  for (var k = 0; k < paramsArr.length && paramsArr[k].chainId != chainId; k++);
  let params = paramsArr[k];
  if (chainId != params.chainId) {
    throw new Error("ChainId doesn't match");
  }

  const router = params["router"];
  const zchfDeployment = await get("Frankencoin");
  let zchfContract = await ethers.getContractAt(
    "Frankencoin",
    zchfDeployment.address
  );
  const reserve = await zchfContract.reserve();

  const governanceSender = await deployContract(
    hre,
    "GovernanceSender",
    [reserve, router]
  );

  console.log(`Verify governanceSender: 
    npx hardhat verify --network ${hre.network.name} ${await governanceSender.getAddress()} ${reserve} ${router}`);
};

export default deploy;
deploy.tags = ["main", "GovernanceSender"];
