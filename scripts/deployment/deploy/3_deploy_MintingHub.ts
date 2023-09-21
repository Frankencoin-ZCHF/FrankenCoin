import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../deployUtils";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { get },
    ethers,
  } = hre;

  const positionFactoryDeployment = await get("PositionFactory");
  let positionFactoryContract = await ethers.getContractAt(
    "PositionFactory",
    positionFactoryDeployment.address
  );
  const zchfDeployment = await get("Frankencoin");
  let zchfContract = await ethers.getContractAt(
    "Frankencoin",
    zchfDeployment.address
  );

  let mintingHubContract = await deployContract(hre, "MintingHub", [
    zchfDeployment.address,
    positionFactoryDeployment.address,
  ]);

  //let mintingHubContract = await get("MintingHub");

  console.log(`Verify mintingHubContract:
npx hardhat verify --network sepolia ${await mintingHubContract.getAddress()} ${
    zchfDeployment.address
  } ${positionFactoryDeployment.address}
`);

  // create a minting hub too while we have no ZCHF supply
  try {
    let tx = await zchfContract.initialize(
      await mintingHubContract.getAddress(),
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
