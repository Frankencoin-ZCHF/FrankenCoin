import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {deployContract} from "../deployUtils";
let deploymode: string = <string>process.env.deploymode;

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    if (deploymode!="base") {
        return;
    }
    const {
        deployments: { get },
    } = hre;
    await deployContract(hre, "PositionFactory");

    // set PositionFactory address in ZCHF
    const positionFactoryDeployment = await get("PositionFactory");
    let positionFactoryContract = await ethers.getContractAt("PositionFactory", 
        positionFactoryDeployment.address);

    const zchfDeployment = await get("Frankencoin");
    let zchfContract = await ethers.getContractAt("Frankencoin", 
        zchfDeployment.address);
    console.log("ZCHF set position factory address =", positionFactoryDeployment.address.toString());
    let tx = await zchfContract.setPositionFactory(positionFactoryDeployment.address, { gasLimit: 1_000_000 });
    await tx.wait();
};
export default deploy;
