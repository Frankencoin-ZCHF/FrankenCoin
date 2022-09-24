import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {deployContract, sleep} from "../deployUtils";
import { BigNumber } from "ethers";
import { floatToDec18 } from "../../math";
let deploymode: string = <string>process.env.deploymode;

async function deployPos(params, mintingHubContract) {
    /*
    let tx = await mintingHubContract.openPosition(collateral, minCollateral, 
        fInitialCollateral, initialLimit, duration, challengePeriod, fFees, 
        fliqPrice, fReserve);
    */
    //------
    let collateralAddr = params.collateralTknAddr;
    let fMinCollateral = floatToDec18(params.minCollateral);
    let fInitialCollateral = floatToDec18(params.initialCollateral);
    let initialLimitZCHF = floatToDec18(params.initialLimitZCHF);
    let duration = BigNumber.from(params.durationDays).mul(86_400);
    let challengePeriod = params.challengePeriodSeconds;
    let feesPPM = params.feesPercent * 1e4;
    let fliqPrice = floatToDec18(params.liqPriceCHF);
    let fReservePPM = params.reservePercent * 1e4;
    let tx = await mintingHubContract.openPosition(collateralAddr, fMinCollateral, 
        fInitialCollateral, initialLimitZCHF, duration, challengePeriod, feesPPM, 
        fliqPrice, fReservePPM);
    await tx.wait();
    console.log("Deployed position, tx =", tx);
}

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    if (deploymode!="pos") {
        return;
    }
    const paramFile = "paramsPositions.json";

    let chainId = hre.network.config["chainId"];
    let paramsArr = require(__dirname + `/parameters/${paramFile}`);

    // get minting hub contract
    const {deployments: { get },} = hre;
    const mintingHubDeployment = await get("MintingHub");
    let mintingHubContract = await ethers.getContractAt("MintingHub", 
        mintingHubDeployment.address);

    // find config for current chain
    for(var k=0; k<paramsArr.length; k++) {
        let params = paramsArr[k];
        if (chainId==params.chainId) {
            await deployPos(mintingHubContract, params);
        }
    }
};
export default deploy;
