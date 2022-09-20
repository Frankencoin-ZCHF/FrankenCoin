/*
    Script to document front-end functions
    1) set private key in terminal without 0x, via export PK="123cafefefefefeCACe..."
        action will be done for that wallet
    2) edit start function to call what is of interest
    4) ts-node scripts/maintenance/frontEndDocumentation.ts
*/
const ethers = require("ethers");
import { SigningKey } from "@ethersproject/signing-key";
import { floatToDec18, dec18ToFloat } from "../math";
const NODE_URL = "https://rpc.sepolia.org";
const ERC20_ABI = require('../../abi/MockXCHFToken.json');
const ZCHF_ABI = require('../../abi/Frankencoin.json');
const EQUITY_ABI = require('../../abi/Equity.json');

const BRIDGE_ABI = require('../../abi/StablecoinBridge.json');
const mockXCHFAddr = "0x081AEb4c123DF59a31890E038A1cCCAa32F41616";
const ZCHFAddr = "0x80909ffEE7097da98d4DEb210e79B6231B26Cf5d";

let pk: string | SigningKey = <string>process.env.PK;

export async function getSigningManagerFromPK(ctrAddr, ctrAbi, nodeUrl, pk) {
    const provider = new ethers.providers.JsonRpcProvider(nodeUrl);
    const wallet = new ethers.Wallet(pk);
    const signer = wallet.connect(provider);
    const signingContractManager = new ethers.Contract(ctrAddr, ctrAbi, signer);
    return signingContractManager;
}


async function queryReservePoolShareSupply() {
    let ZCHFContract = await getSigningManagerFromPK(ZCHFAddr, ZCHF_ABI, NODE_URL, pk);
    let reserveAddress = await ZCHFContract.reserve();
    let equityContract = await getSigningManagerFromPK(reserveAddress, EQUITY_ABI, NODE_URL, pk);
    let fBalancePoolShareTokens = await equityContract.totalSupply();
    let supply = dec18ToFloat(fBalancePoolShareTokens);
    return supply;
}

async function start() {
    let supply = await queryReservePoolShareSupply();
    console.log("supply = ", supply, "RPS");
}
start();