import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { deployContract } from "../deployUtils";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { get },
  } = hre;

  const positionFactoryDeployment = await get("PositionFactory");
  const zchfDeployment = await get("Frankencoin");
  let positionFactoryContract = await ethers.getContractAt(
    "PositionFactory",
    positionFactoryDeployment.address
  );
  let zchfContract = await ethers.getContractAt(
    "Frankencoin",
    zchfDeployment.address
  );

  let mintingHubContract = await deployContract(hre, "MintingHub", [
    zchfContract.address,
    positionFactoryContract.address,
  ]);

  //let mintingHubContract = await get("MintingHub");

  console.log(
    `Verify mintingHubContract:\nnpx hardhat verify --network sepolia ${mintingHubContract.address} ${zchfContract.address} ${positionFactoryContract.address}\n`
  );

  // create a minting hub too while we have no ZCHF supply
  try {
    let tx = await zchfContract.initialize(
      mintingHubContract.address,
      "Minting Hub"
    );
    await tx.wait();
  } catch (err) {
    console.log("Suggest minter failed, probably already registered:");
    console.error(err);
  }
};
export default deploy;
deploy.tags = ["main", "MintingHub"];
