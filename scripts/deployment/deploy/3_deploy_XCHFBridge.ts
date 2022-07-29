import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {deployContract, sleep} from "../deployUtils";
import { BigNumber } from "ethers";
import { floatToDec18 } from "../../../scripts/math";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log(hre.network.name);
    const limit = 1_000_000;
    const {
        deployments: { get },
    } = hre;
    let xchfAddress;
    let applicationMsg;
    if (hre.network.name in ["hardhat", "localhost", "sepolia"]) {
        console.log("Deploying Mock-XCHF-Token Bridge");
        const xchfDeployment = await get("MockXCHFToken");
        xchfAddress = xchfDeployment.address;
        applicationMsg = "MockXCHF Token Bridge";
    } else {
        console.log("Deploying XCHF-Token Bridge");
        xchfAddress = "0xb4272071ecadd69d933adcd19ca99fe80664fc08";
        applicationMsg = "XCHF Token Bridge";
    }
    const ZCHFDeployment = await get("Frankencoin");
    let zchfContract = await ethers.getContractAt("Frankencoin", ZCHFDeployment.address);

    let dLimit : BigNumber = floatToDec18(limit);
    console.log("Deploying StablecoinBridge with limit = ", limit, "CHF");
    await deployContract(hre, "StablecoinBridge", [xchfAddress, ZCHFDeployment.address, dLimit]);
    
    // suggest minter
    const bridgeDeployment = await get("StablecoinBridge");

    let isAlreadyMinter = await zchfContract.isMinter(bridgeDeployment.address);
    if (isAlreadyMinter) {
        console.log(bridgeDeployment.address, "already is a minter");
    } else {
        let applicationPeriod = BigNumber.from(0);
        let applicationFee = BigNumber.from(0);
        let msg = "XCHF Bridge";
        console.log("Apply for the bridge ", bridgeDeployment.address, "to be minter via zchf.suggestMinter");
        let tx = await zchfContract.suggestMinter(bridgeDeployment.address, applicationPeriod, applicationFee, msg);
        tx.wait();
        console.log("tx hash = ", tx.hash);
        let isMinter = false;
        let trial = 0;
        while(!isMinter) {
            console.log("Waiting 20s...");
            await sleep(20*1000);
            isMinter = trial>3 || await zchfContract.isMinter(bridgeDeployment.address);
            console.log("Is minter? ", isMinter);
            trial+=1;
        }
    }
    

};
export default deploy;
