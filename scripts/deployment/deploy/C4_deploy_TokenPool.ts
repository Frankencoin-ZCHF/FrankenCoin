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
  const rmnProxy = params["rmnProxy"];
  const zchfDeployment = await get("Frankencoin");
  let zchfContract = await ethers.getContractAt(
    "Frankencoin",
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
  const txAcceptOwner = await ccipAdminContract.acceptOwnership();
  await txAcceptOwner.wait();

  console.log("Setting token pool");
  const tx = await ccipAdminContract.setTokenPool(
    await burnMintTokenPool.getAddress()
  );
  await tx.wait();

  console.log("Add pool as minter");
  const txMinter = await zchfContract.initialize(
    await burnMintTokenPool.getAddress(),
    "CCIP Token Pool"
  );
  await txMinter.wait();
};

export default deploy;
deploy.tags = ["l2"];
