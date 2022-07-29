
import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {deployContract} from "../deployUtils";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {

    const {
        deployments: { get },
    } = hre;
    const reservePoolDeployment = await get("ReservePool");
    let reservePoolContract = await ethers.getContractAt("ReservePool", reservePoolDeployment.address);
    
    await deployContract(hre, "Frankencoin", [reservePoolContract.address]);
    const zchf = await get("Frankencoin");
    let zchfContract = await ethers.getContractAt("Frankencoin", zchf.address);
    await reservePoolContract.initialize(zchfContract.address);
    console.log("reservePoolContract initialized to Frankencoin address", zchfContract.address);
};
export default deploy;
