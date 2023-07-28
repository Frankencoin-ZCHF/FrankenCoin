import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { deployContract, ZERO_ADDRESS } from "../deployUtils";

/*
    //see package.json
    export PK=12...
    // deploy according to config (see package.json), e.g., 
    npm run redeploynotesttoken:network sepolia
    // mint ZCHF via scripts/maintenance/mintCHF.ts (adjust StableCoinBridge address in mintCHF.ts header) 
    ts-node scripts/maintenance/mintCHF.ts
    // verify on https://sepolia.etherscan.io/
    // deploy positions (inspect script A_deploy_...)
    npm run-script deployPositions:network sepolia
*/
const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const paramFile = "paramsFrankencoin.json";
    let chainId = hre.network.config["chainId"];
    let paramsArr = require(__dirname + `/../parameters/${paramFile}`);
    // find config for current chain
    for (var k = 0; k < paramsArr.length && paramsArr[k].chainId != chainId; k++);
    let params = paramsArr[k];
    if (chainId != params.chainId) {
        throw new Error("ChainId doesn't match");
    }
    let minApplicationPeriod = params['minApplicationPeriod'];
    console.log("Min application period =", minApplicationPeriod);
    let FC = await deployContract(hre, "Frankencoin", [minApplicationPeriod]);
    let abiCoder = new ethers.utils.AbiCoder();
    let encodeString = abiCoder.encode(['uint256'], [minApplicationPeriod]);
    console.log("Constructor Arguments ABI Encoded (Frankencoin at ", FC.address, "):");
    console.log(encodeString);
    console.log(`Verify Frankencoin:\nnpx hardhat verify --network sepolia ${FC.address} ${minApplicationPeriod}`)

    let reserve = await FC.reserve();
    encodeString = abiCoder.encode(['address'], [FC.address]);
    console.log("Constructor Arguments ABI Encoded (Equity):");
    console.log(encodeString);
    console.log(`Verify Equity:\nnpx hardhat verify --network sepolia ${reserve} ${FC.address}`)
};
export default deploy;
deploy.tags = ["main", "Frankencoin"];

