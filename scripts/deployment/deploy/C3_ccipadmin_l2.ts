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

  const tokenAdminRegistry = params["tokenAdminRegistry"];
  const vetoPeriod = params["vetoPeriod"];
  const registryModuleOwner = params["registryModuleOwner"];
  const zchfDeployment = await get("Frankencoin");
  let zchfContract = await ethers.getContractAt(
    "Frankencoin",
    zchfDeployment.address
  );
  const reserve = await zchfContract.reserve();

  const ccipAdmin = await deployContract(hre, "CCIPAdmin", [
    reserve,
    tokenAdminRegistry,
    vetoPeriod,
    zchfDeployment.address,
    registryModuleOwner
  ]);

  console.log(`Verify ccipadmin: 
    npx hardhat verify --network ${hre.network.name} ${await ccipAdmin.getAddress()} ${reserve} ${tokenAdminRegistry} ${vetoPeriod} ${
    zchfDeployment.address
  } ${registryModuleOwner}
  `);

  console.log('Accepting token admin');
  const tx = await ccipAdmin.acceptAdmin();
  await tx.wait()
};

export default deploy;
deploy.tags = ["l2"];
