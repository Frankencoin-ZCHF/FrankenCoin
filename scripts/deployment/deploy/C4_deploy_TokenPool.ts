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
  const ccipParams = ccipParamsFile.find((x: { chainId: number }) => x.chainId == chainId);

  const router = ccipParams["router"];
  const rmnProxy = ccipParams["rmnProxy"];
  const zchfDeployment = await get("BridgedFrankencoin");
  let zchfContract = await ethers.getContractAt(
    "BridgedFrankencoin",
    zchfDeployment.address
  );
  const decimals = await zchfContract.decimals();

  const burnMintTokenPool = await deployContract(hre, "BurnMintTokenPool", [
    zchfDeployment.address,
    decimals,
    [],
    rmnProxy,
    router,
  ]);

  console.log(`To verify BurnMintTokenPool create an arguments.js file with the folowing content: 
    module.exports = [
      "${zchfDeployment.address}",
      ${decimals},
      [],
      "${rmnProxy}",
      "${router}",
    ];

    Then verify it with
    npx hardhat verify --network ${
      hre.network.name
    } --constructor-args arguments.js ${await burnMintTokenPool.getAddress()}
  `);

  const ccipAdminDeployment = await get("CCIPAdmin");
  let ccipAdminContract = await ethers.getContractAt(
    "CCIPAdmin",
    ccipAdminDeployment.address
  );

  console.log("Transfer token pool owner");
  const txOwnerTransfer = await burnMintTokenPool.transferOwnership(
    await ccipAdminContract.getAddress()
  );
  await txOwnerTransfer.wait();

  console.log("Add pool as minter");
  const txMinter = await zchfContract.initialize(
    await burnMintTokenPool.getAddress(),
    "CCIP Token Pool"
  );
  await txMinter.wait();

  console.log("Deployment done");
  console.log("");
  console.log("NEXT STEPS:")
  console.log(
    `Ping now the Chainlink team to propose CCIPAdmin (${ccipAdminDeployment.address}) as admin for ZCHF (${zchfDeployment.address})`
  );
  console.log(
    `After they have confirmed the proposal, call acceptAdmin(), setTokenPool(${await burnMintTokenPool.getAddress()}) and acceptOwnership() on CCIPAdmin (${
      ccipAdminDeployment.address
    }) in this order.`
  );
};

export default deploy;
deploy.tags = ["l2"];
