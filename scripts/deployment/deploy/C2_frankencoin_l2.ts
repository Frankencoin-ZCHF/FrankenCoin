import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../deployUtils";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { get },
  } = hre;

  let chainId = hre.network.config["chainId"];
  let frankenCoinParamsFile = require(__dirname +
    `/../parameters/paramsFrankencoin.json`);
  // find config for current chain
  const frankenCoinParams = frankenCoinParamsFile.find((x: { chainId: number }) => x.chainId == chainId);
  let ccipParamsFile = require(__dirname + `/../parameters/paramsCCIP.json`);
  // find config for current chain
  const ccipParams = ccipParamsFile.find((x: { chainId: number }) => x.chainId == chainId);

  let minApplicationPeriod = frankenCoinParams["minApplicationPeriod"];
  console.log("\nMin application period =", minApplicationPeriod);

  const bridgedGovernance = await get("BridgedGovernance");
  const zchf = await deployContract(hre, "BridgedFrankencoin", [
    bridgedGovernance.address,
    ccipParams.router,
    minApplicationPeriod,
    ccipParams.link,
    ccipParams.mainnetChainSelector,
    ccipParams.bridgeAccounting
  ]);

  console.log(`Verify zchf: 
    npx hardhat verify --network ${
      hre.network.name
    } ${await zchf.getAddress()} ${bridgedGovernance.address} ${
    ccipParams.router
  } ${minApplicationPeriod} ${ccipParams.link} ${
    ccipParams.mainnetChainSelector
  } ${ccipParams.bridgeAccounting}
  `);
};

export default deploy;
deploy.tags = ["l2"];
