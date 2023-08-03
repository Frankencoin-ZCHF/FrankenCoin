import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { deployContract } from "../deployUtils";


const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {
        deployments: { get },
    } = hre;
    await deployContract(hre, "PositionFactory");

    // set PositionFactory address in ZCHF
    const positionFactoryDeployment = await get("PositionFactory");
    let positionFactoryContract = await ethers.getContractAt("PositionFactory",
        positionFactoryDeployment.address);
    console.log(`\nVerify positionFactory:\nnpx hardhat verify --network sepolia ${positionFactoryDeployment.address}`)
};
export default deploy;
deploy.tags = ["main", "PositionFactory"];