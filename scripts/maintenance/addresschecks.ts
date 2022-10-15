/*
    Script to check Frankencoin address consistency
    1) set private key in terminal without 0x, via export PK="123cafefefefefeCACe..."
        minting will be done for that wallet
    2) edit script: add minting hub address
    4) ts-node scripts/maintenance/addresschecks.ts
*/
const ethers = require("ethers");
import { SigningKey } from "@ethersproject/signing-key";
import { Contract } from "hardhat/internal/hardhat-network/stack-traces/model";
import { floatToDec18 } from "../math";
import {getSigningManagerFromPK} from "../utils";
const NODE_URL = "https://rpc.sepolia.org";
const ERC20_ABI = require('../../abi/MockXCHFToken.json');
const FC_ABI = require('../../abi/Frankencoin.json');
const BRIDGE_ABI = require('../../abi/StablecoinBridge.json');
const MH_ABI = require('../../abi/MintingHub.json');

let pk: string | SigningKey = <string>process.env.PK;

let mintingHubAddr = "0x4faFcA8CB68a889aDB9e0bA723343A822d5dc331";

async function run() {
    //const wallet = new ethers.Wallet(pk);
    let mintingHubContract = await getSigningManagerFromPK(mintingHubAddr, MH_ABI, NODE_URL, pk);
    let zchfAddr = await mintingHubContract.zchf();
    let zchfContract = await getSigningManagerFromPK(zchfAddr, FC_ABI, NODE_URL, pk);
    console.log("Minting Hub     : \t", mintingHubAddr);
    console.log("Frankencoin ZCHF: \t", zchfAddr);
    let reserve = await zchfContract.reserve();
    console.log("Reserve (=Equity): \t", reserve);

}

run();