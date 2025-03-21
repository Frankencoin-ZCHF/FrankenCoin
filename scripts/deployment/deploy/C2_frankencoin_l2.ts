import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../deployUtils";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { get },
  } = hre;

  const paramFile = "paramsFrankencoin.json";
  let chainId = hre.network.config["chainId"];
  let paramsArr = require(__dirname + `/../parameters/${paramFile}`);
  // find config for current chain
  for (var k = 0; k < paramsArr.length && paramsArr[k].chainId != chainId; k++);
  let params = paramsArr[k];
  if (chainId != params.chainId) {
    throw new Error("ChainId doesn't match");
  }

  let minApplicationPeriod = params["minApplicationPeriod"];
  console.log("\nMin application period =", minApplicationPeriod);

  const deployer = (await hre.getNamedAccounts())["deployer"];
  const nonce = await hre.ethers.provider.getTransactionCount(deployer);
  const adminAddress = hre.ethers.getCreateAddress({
    from: deployer,
    nonce: nonce + 1,
  });
  const bridgedGovernance = await get("BridgedGovernance");
  const zchf = await deployContract(hre, "Frankencoin", [
    minApplicationPeriod,
    adminAddress,
    bridgedGovernance.address,
  ]);

  console.log(`Verify zchf: 
    npx hardhat verify --network ${hre.network.name} ${await zchf.getAddress()} ${minApplicationPeriod} ${adminAddress} ${
    bridgedGovernance.address
  }
  `);
};

export default deploy;
deploy.tags = ["l2"];
