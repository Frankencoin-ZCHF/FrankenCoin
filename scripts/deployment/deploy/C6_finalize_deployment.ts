import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

function getChainUpdate(ccipParams: any, chainName: string) {
  const chainCcipParams = ccipParams.find(
    (x: { chainName: string }) =>
      x.chainName.toLowerCase() == chainName.toLowerCase()
  );
  if (
    chainCcipParams["zchf"] &&
    chainCcipParams["tokenPool"] &&
    chainCcipParams["chainSelector"]
  ) {
    return {
      remoteChainSelector: chainCcipParams["chainSelector"],
      remotePoolAddresses: [chainCcipParams["tokenPool"]],
      remoteTokenAddress: chainCcipParams["zchf"],
      outboundRateLimiterConfig: {
        isEnabled: false,
        capacity: 0,
        rate: 0,
      },
      inboundRateLimiterConfig: {
        isEnabled: false,
        capacity: 0,
        rate: 0,
      },
    };
  }
  return undefined;
}

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

  const ccipAdmin = await ethers.getContractAt(
    "CCIPAdmin",
    ccipAdminDeployment.address
  );

  const chainUpdates = (ccipParams["remoteChains"] as string[])
    .map((chain: string) => getChainUpdate(ccipParamsFile, chain))
    .filter((x) => x !== undefined);

  console.log("Registering CCIPAdmin as admin...");
  const adminRegisterTx = await ccipAdmin.registerToken(
    registryModuleOwnerAddress
  );
  console.log(`TX: ${adminRegisterTx.hash}`);
  await adminRegisterTx.wait();
  console.log("Registering CCIPAdmin as admin... Done");
  console.log("Accepting admin... Done");
  console.log(`Setting token pool ${tokenPoolDeployment.address}...`);
  const setTokenPoolTx = await ccipAdmin.setTokenPool(
    tokenPoolDeployment.address,
    chainUpdates
  );
  console.log(`TX: ${setTokenPoolTx.hash}`);
  await setTokenPoolTx.wait();
  console.log("Setting token pool... Done");
};

export default deploy;
deploy.tags = ["l2"];
