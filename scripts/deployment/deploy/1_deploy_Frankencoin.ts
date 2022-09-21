import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {deployContract, ZERO_ADDRESS} from "../deployUtils";

/*
    see package.json
    export PK=12...
    npx hardhat deploy --network sepolia
*/
const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {

    await deployContract(hre, "Frankencoin");
    
};
export default deploy;
