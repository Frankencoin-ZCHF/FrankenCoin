/*
    Script to deposit dEURO to reserve pool
    1) set private key in terminal without 0x, via export PK="123cafefefefefeCACe..."
        action will be done for that wallet
    2) edit script if needed
    4) ts-node scripts/maintenance/depositToReservePool.ts
*/
const ethers = require("ethers");
import { SigningKey } from "@ethersproject/signing-key";
import { floatToDec18, dec18ToFloat } from "../math";
const NODE_URL = "https://rpc.sepolia.org";
const ERC20_ABI = require('../../abi/MockXEURToken.json');
const dEURO_ABI = require('../../abi/EuroCoin.json');
const EQUITY_ABI = require('../../abi/Equity.json');

const BRIDGE_ABI = require('../../abi/StablecoinBridge.json');
const mockXEURAddr = "0x081AEb4c123DF59a31890E038A1cCCAa32F41616";
const dEUROAddr = "0x079909c5191fffF4AB4Ad7889B34821D4CE35f6b";

let pk: string | SigningKey = <string>process.env.PK;

export async function getSigningManagerFromPK(ctrAddr, ctrAbi, nodeUrl, pk) {
    const provider = new ethers.providers.JsonRpcProvider(nodeUrl);
    const wallet = new ethers.Wallet(pk);
    const signer = wallet.connect(provider);
    const signingContractManager = new ethers.Contract(ctrAddr, ctrAbi, signer);
    return signingContractManager;
}

async function depositdEURO(amountdEURO : number) {
   
    let dEUROContract = await getSigningManagerFromPK(dEUROAddr, dEURO_ABI, NODE_URL, pk);
    let reserveAddress = await dEUROContract.reserve();
    let equityContract = await getSigningManagerFromPK(reserveAddress, EQUITY_ABI, NODE_URL, pk);
    let fOldBalancedEURO = await dEUROContract.balanceOf(reserveAddress);
    let fOldBalancePoolShareTokens = await equityContract.totalSupply();
    
    console.log("Reserve (dEURO) before =", dec18ToFloat(fOldBalancedEURO));
    console.log("Pool Shares before =", dec18ToFloat(fOldBalancePoolShareTokens));
    let tx = await dEUROContract.transferAndCall(reserveAddress, floatToDec18(amountdEURO), 0);
    await tx.wait();
    console.log("tx = ", tx);
    let fNewBalancedEURO = await dEUROContract.balanceOf(reserveAddress);
    let fNewBalancePoolShareTokens = await equityContract.totalSupply();
    console.log("Reserve (dEURO) after =", dec18ToFloat(fNewBalancedEURO));
    console.log("Pool Shares after =", dec18ToFloat(fNewBalancePoolShareTokens));
    
}
async function start() {
    let amountdEURO = 500; // how much dEURO do we deposit to reserve from your wallet (=Equity contract)
    await depositdEURO(amountdEURO);
}
start();