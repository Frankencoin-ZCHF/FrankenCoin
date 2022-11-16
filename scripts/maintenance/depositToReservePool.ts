/*
    Script to deposit ZCHF to reserve pool
    1) set private key in terminal without 0x, via export PK="123cafefefefefeCACe..."
        action will be done for that wallet
    2) edit script if needed
    4) ts-node scripts/maintenance/depositToReservePool.ts
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
const ZCHFAddr = "0x079909c5191fffF4AB4Ad7889B34821D4CE35f6b";

let pk: string | SigningKey = <string>process.env.PK;

export async function getSigningManagerFromPK(ctrAddr, ctrAbi, nodeUrl, pk) {
    const provider = new ethers.providers.JsonRpcProvider(nodeUrl);
    const wallet = new ethers.Wallet(pk);
    const signer = wallet.connect(provider);
    const signingContractManager = new ethers.Contract(ctrAddr, ctrAbi, signer);
    return signingContractManager;
}

async function depositZCHF(amountZCHF : number) {
   
    let ZCHFContract = await getSigningManagerFromPK(ZCHFAddr, ZCHF_ABI, NODE_URL, pk);
    let reserveAddress = await ZCHFContract.reserve();
    let equityContract = await getSigningManagerFromPK(reserveAddress, EQUITY_ABI, NODE_URL, pk);
    let fOldBalanceZCHF = await ZCHFContract.balanceOf(reserveAddress);
    let fOldBalancePoolShareTokens = await equityContract.totalSupply();
    
    console.log("Reserve (ZCHF) before =", dec18ToFloat(fOldBalanceZCHF));
    console.log("Pool Shares before =", dec18ToFloat(fOldBalancePoolShareTokens));
    let tx = await ZCHFContract.transferAndCall(reserveAddress, floatToDec18(amountZCHF), 0);
    await tx.wait();
    console.log("tx = ", tx);
    let fNewBalanceZCHF = await ZCHFContract.balanceOf(reserveAddress);
    let fNewBalancePoolShareTokens = await equityContract.totalSupply();
    console.log("Reserve (ZCHF) after =", dec18ToFloat(fNewBalanceZCHF));
    console.log("Pool Shares after =", dec18ToFloat(fNewBalancePoolShareTokens));
    
}
async function start() {
    let amountZCHF = 500; // how much ZCHF do we deposit to reserve from your wallet (=Equity contract)
    await depositZCHF(amountZCHF);
}
start();