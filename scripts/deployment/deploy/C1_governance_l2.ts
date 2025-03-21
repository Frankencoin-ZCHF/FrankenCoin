import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../deployUtils";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { get },
    ethers,
    network
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
  const mainnetChainSelector = params["mainnetChainSelector"]
  const mainnetGovernanceSender = params["mainnetGovernanceSender"]

  const bridgedGovernance = await deployContract(
    hre,
    "BridgedGovernance",
    [router, mainnetChainSelector, mainnetGovernanceSender]
  );

  console.log(`Verify bridgedGovernance: 
    npx hardhat verify --network ${network.name} ${await bridgedGovernance.getAddress()} ${router} ${mainnetChainSelector} ${mainnetGovernanceSender}`);
};

export default deploy;
deploy.tags = ["l2"];
