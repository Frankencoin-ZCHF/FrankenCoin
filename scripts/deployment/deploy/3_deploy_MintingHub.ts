import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {deployContract} from "../deployUtils";


const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {
        deployments: { get },
    } = hre;
    
    const positionFactoryDeployment = await get("PositionFactory");
    const zchfDeployment = await get("Frankencoin");
    let positionFactoryContract = await ethers.getContractAt("PositionFactory", 
        positionFactoryDeployment.address);
    let zchfContract = await ethers.getContractAt("Frankencoin", zchfDeployment.address);;
    let mintingHubContract = await deployContract(hre, "MintingHub", 
        [zchfContract.address, positionFactoryContract.address]);
};
export default deploy;
