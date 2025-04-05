import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../deployUtils";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { get },
    ethers,
  } = hre;
  let chainId = hre.network.config["chainId"];
  let ccipParamsFile = require(__dirname + `/../parameters/paramsCCIP.json`);
  // find config for current chain
  const ccipParams = ccipParamsFile.find(
    (x: { chainId: number }) => x.chainId == chainId
  );

  const registryModuleOwnerAddress = ccipParams["registryModuleOwner"];
  const ccipAdminDeployment = await get("CCIPAdmin");
  const tokenPoolDeployment = await get("BurnMintTokenPool");

  const ccipAdmin = await ethers.getContractAt("CCIPAdmin", ccipAdminDeployment.address)

  console.log("Registering CCIPAdmin as admin...");
  const adminRegisterTx = await ccipAdmin.registerToken(registryModuleOwnerAddress)
  console.log(`TX: ${adminRegisterTx.hash}`);
  await adminRegisterTx.wait();
  console.log("Registering CCIPAdmin as admin... Done");
  console.log("Accepting admin...");
  const acceptAdminTx = await ccipAdmin.acceptAdmin();
  console.log(`TX: ${acceptAdminTx.hash}`);
  await acceptAdminTx.wait();
  console.log("Accepting admin... Done");
  console.log(`Setting token pool ${tokenPoolDeployment.address}...`);
  const setTokenPoolTx = await ccipAdmin.setTokenPool(tokenPoolDeployment.address);
  console.log(`TX: ${setTokenPoolTx.hash}`);
  await setTokenPoolTx.wait();
  console.log("Setting token pool... Done");
  console.log("Accepting ownership...");
  const acceptOwnershipTx = await ccipAdmin.acceptOwnership();
  console.log(`TX: ${acceptOwnershipTx.hash}`);
  await acceptOwnershipTx.wait();
  console.log("Accepting ownership... Done");
};

export default deploy;
deploy.tags = ["l2"];
