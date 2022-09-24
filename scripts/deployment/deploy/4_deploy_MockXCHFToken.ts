
import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {deployContract} from "../deployUtils";
let deploymode: string = <string>process.env.deploymode;

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    if (deploymode!="base") {
        return;
    }
    await deployContract(hre, "MockXCHFToken");
};
export default deploy;
