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
    const paramFile = "params.json";
    let chainId = hre.network.config["chainId"];
    let paramsArr = require(__dirname + `/parameters/${paramFile}`);
    // find config for current chain
    for(var k=0; k<paramsArr.length && paramsArr[k].chainId!=chainId; k++);
    let params = paramsArr[k];
    if (chainId!=params.chainId) {
        throw new Error("ChainId doesn't match");
    }
    let minApplicationPeriod=params['minApplicationPeriod'];
    console.log("Min application period =", minApplicationPeriod);
    await deployContract(hre, "Frankencoin", [minApplicationPeriod]);
    
};
export default deploy;
