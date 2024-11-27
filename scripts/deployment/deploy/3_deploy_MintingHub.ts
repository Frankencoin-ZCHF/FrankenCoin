import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../deployUtils";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { get },
    ethers,
  } = hre;

  // const positionFactoryDeployment = await get("PositionFactory");
  const positionFactoryDeploymentAddress = "0x5F9C74b58D2C0a4FaB41318F94b5A23ba27FA98a";

  // const positionRollerDeployment = await get("PositionRoller");
  const positionRollerDeploymentAddress = "0x63B6654034C4a5Fc7901444031932825223C9Ac6";

  // const dEuroDeployment = await get("DecentralizedEURO");
  const dEuroDeploymentAddress = "0xd45e911843721083A2751fA9Cc9D2a8089D8C0f5";

  // const leadrateDeployment = await get("Leadrate");
  const leadrateDeploymentAddress = "0x42c43F17Dbea70a4a6f1ff9F3E5c023Da21B42C1";

  let dEUROContract = await ethers.getContractAt(
    "DecentralizedEURO",
    dEuroDeploymentAddress
  );

  let mintingHubContract = await deployContract(hre, "MintingHub", [
    dEuroDeploymentAddress,
    leadrateDeploymentAddress,
    positionRollerDeploymentAddress,
    positionFactoryDeploymentAddress,
  ]);

  //let mintingHubContract = await get("MintingHub");

  console.log(`Verify mintingHubContract: npx hardhat verify --network sepolia ${await mintingHubContract.getAddress()} ${dEuroDeploymentAddress} ${leadrateDeploymentAddress} ${positionRollerDeploymentAddress} ${positionFactoryDeploymentAddress}`);

  // create a minting hub too while we have no dEURO supply
  try {
    let tx = await dEUROContract.initialize(
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
