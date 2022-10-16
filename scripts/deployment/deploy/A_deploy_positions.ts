import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { dec18ToFloat, floatToDec18 } from "../../math";

//'deploymode' is defined in package.json as part of command deployPositions/deploy
let deploymode: string = <string>process.env.deploymode;

/*
    HOWTO
    - inspect config file parameters/paramsPositions
    - ensure minter has enough collateral and ZCHF to ask for position
    - run via: npm run-script deployPositions:network sepolia
*/

async function deployPos(params, hre: HardhatRuntimeEnvironment) {
    /*
    let tx = await mintingHubContract.openPosition(collateral, minCollateral, 
        fInitialCollateral, initialLimit, duration, challengePeriod, fFees, 
        fliqPrice, fReserve);
    */
    //------
    // get minting hub contract
    const {deployments: { get },} = hre;
    const mintingHubDeployment = await get("MintingHub");
    const fcDeployment = await get("Frankencoin");
    const collateralDeployment = await get(params.name);

    let mintingHubContract = await ethers.getContractAt("MintingHub", 
        mintingHubDeployment.address);
    
    let collateralAddr = params.collateralTknAddr;
    let fMinCollateral = floatToDec18(params.minCollateral);
    let fInitialCollateral = floatToDec18(params.initialCollateral);
    let initialLimitZCHF = floatToDec18(params.initialLimitZCHF);
    let duration = BigNumber.from(params.durationDays).mul(86_400);
    let challengePeriod = BigNumber.from(params.challengePeriodSeconds);
    let feesPPM = BigNumber.from(params.feesPercent * 1e4);
    let fliqPrice = floatToDec18(params.liqPriceCHF);
    let fReservePPM = BigNumber.from(params.reservePercent * 1e4);
    let fOpeningFeeZCHF = BigNumber.from(2000).mul(BigNumber.from(10).pow(18));

    // approvals
    let ZCHFContract = await ethers.getContractAt("Frankencoin", 
        fcDeployment.address);
    let CollateralContract = await ethers.getContractAt(params.name, 
        params.collateralTknAddr);

    let pk: string = <string>process.env.PK;
    let wallet = new ethers.Wallet(pk);   
    //console.log("Collateral balance of owner = ", dec18ToFloat(balColl));
    //console.log("ZCHF balance of owner = ", dec18ToFloat(balZCHF));
    console.log("ZCHF address ", fcDeployment.address);
    console.log("coll address ", CollateralContract.address);
    console.log("owner address ", wallet.address);
    
    let tx1 = await CollateralContract.approve(mintingHubContract.address, fInitialCollateral,  { gasLimit: 1_000_000 });
    let tx2 = await ZCHFContract.approve(mintingHubContract.address, fOpeningFeeZCHF,  { gasLimit: 1_000_000 });
    /*
        address _collateral, uint256 _minCollateral, 
        uint256 _initialCollateral, uint256 _initialLimit, 
        uint256 _duration, uint256 _challengePeriod, uint32 _fees, uint256 _liqPrice, uint32 _reserve) 

    */
    let tx = await mintingHubContract.openPosition(collateralAddr, fMinCollateral, 
        fInitialCollateral, initialLimitZCHF, duration, challengePeriod, feesPPM, 
        fliqPrice, fReservePPM,  { gasLimit: 3_000_000 });

    await tx.wait();
    
    let abiCoder = new ethers.utils.AbiCoder();
    
    let encodeString = abiCoder.encode(['address', 'uint256', 'uint256', 'uint256','uint256', 
        'uint256', 'uint32', 'uint256', 'uint32'], 
        [collateralAddr, fMinCollateral, fInitialCollateral, initialLimitZCHF, duration, challengePeriod, feesPPM, 
            fliqPrice, fReservePPM]);
    console.log("Constructor Arguments ABI Encoded (Position):");
    console.log(encodeString);

    return tx.hash;
}

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    if (deploymode!="pos") {
        return;
    }
    const paramFile = "paramsPositions.json";

    let chainId = hre.network.config["chainId"];
    let paramsArr = require(__dirname + `/../parameters/${paramFile}`);

    // find config for current chain
    for(var k=0; k<paramsArr.length; k++) {
        let params = paramsArr[k];
        if (chainId==params.chainId) {
            // deploy position according to parameters
            let txh = await deployPos(params, hre);
            console.log("Deployed position, tx hash =", txh);
        }
    }
};
export default deploy;
