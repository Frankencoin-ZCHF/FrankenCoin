import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { deployContract, sleep } from "../deployUtils";
import { BigNumber } from "ethers";
import { floatToDec18 } from "../../math";
import { StablecoinBridge } from "../../../typechain";
var prompt = require('prompt');

async function getAddress() {
    let addr = "0xCf3f8985e8aA051C15ED7baBCeEAc9aaD6711a85";
    console.log("Is this address for MOCKCHF ok? [y,N]", addr)
    prompt.start();
    const { isOk } = await prompt.get(['isOk']);
    if (isOk != "y" && isOk != "Y") {
        return "";
    }
    return addr;
}

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {

    console.log(hre.network.name);
    const limit = 10_000_000;
    const {
        deployments: { get },
    } = hre;
    let xchfAddress;
    let applicationMsg;
    if (["hardhat", "localhost", "sepolia"].includes(hre.network.name)) {
        console.log("Setting Mock-XCHF-Token Bridge");
        try {
            const xchfDeployment = await get("MockXCHFToken");
            xchfAddress = xchfDeployment.address;
        } catch (err: unknown) {
            xchfAddress = await getAddress();
            if (xchfAddress == "") {
                throw (err);
            }
        }

        applicationMsg = "MockXCHF Token Bridge";
    } else {
        console.log("Deploying XCHF-Token Bridge");
        xchfAddress = "0xCf3f8985e8aA051C15ED7baBCeEAc9aaD6711a85";
        applicationMsg = "XCHF Token Bridge";
    }
    const ZCHFDeployment = await get("Frankencoin");
    let zchfContract = await ethers.getContractAt("Frankencoin", ZCHFDeployment.address);

    let dLimit: BigNumber = floatToDec18(limit);
    console.log("Deploying StablecoinBridge with limit = ", limit, "CHF");
    const bridge = <StablecoinBridge>await deployContract(hre, "StablecoinBridge", [xchfAddress, ZCHFDeployment.address, dLimit]);

    // suggest minter
    const bridgeDeployment = await get("StablecoinBridge");
    let bridgeAddr: string = bridgeDeployment.address;

    console.log(`Verify StablecoinBridge:\nnpx hardhat verify --network sepolia ${bridgeAddr} ${xchfAddress} ${ZCHFDeployment.address} ${dLimit}\n`);


    let isAlreadyMinter = await zchfContract.isMinter(bridgeAddr, { gasLimit: 1_000_000 });
    if (isAlreadyMinter) {
        console.log(bridgeDeployment.address, "already is a minter");
    } else {
        let msg = "XCHF Bridge";
        console.log("Apply for the bridge ", bridgeDeployment.address, "to be minter via zchf.suggestMinter");
        let tx = await zchfContract.initialize(bridgeDeployment.address, msg);
        console.log("tx hash = ", tx.hash);
        await tx.wait();
        let isMinter = false;
        let trial = 0;
        while (!isMinter && trial < 5) {
            console.log("Waiting 20s...");
            await sleep(20 * 1000);
            isMinter = await zchfContract.isMinter(bridgeAddr, { gasLimit: 1_000_000 });
            console.log("Is minter? ", isMinter);
            trial += 1;
        }
    }

    if (["hardhat", "localhost", "sepolia"].includes(hre.network.name)) {
        let amount = floatToDec18(20_000);
        const mockXCHF = await ethers.getContractAt("TestToken", xchfAddress);
        await mockXCHF.approve(bridgeAddr, amount);
        await bridge.mint(amount);
    }
};
export default deploy;
deploy.tags = ["main", "XCHFBridge"];