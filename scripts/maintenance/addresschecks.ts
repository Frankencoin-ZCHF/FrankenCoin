/*
    Script to check Frankencoin address consistency
    1) set private key in terminal without 0x, via export PK="123cafefefefefeCACe..."
        minting will be done for that wallet
    2) edit script: add minting hub address
    4) ts-node scripts/maintenance/addresschecks.ts
*/
const ethers = require("ethers");
import { SigningKey } from "@ethersproject/signing-key";
import {getSigningManagerFromPK} from "../utils";

const FC_ABI = require('../../abi/Frankencoin.json');
const MH_ABI = require('../../abi/MintingHub.json');

//const NODE_URL = "https://rpc.sepolia.org";
const NODE_URL = "https://ethereum.publicnode.com";

let pk: string | SigningKey = <string>process.env.PK;

let mintingHubAddr = "0x5F8a6244ca00466a38b6d2891685bBB6400e7f5a";

async function run() {
    //const wallet = new ethers.Wallet(pk);
    let mintingHubContract = await getSigningManagerFromPK(mintingHubAddr, MH_ABI, NODE_URL, pk);
    let zchfAddr = await mintingHubContract.zchf();
    let zchfContract = await getSigningManagerFromPK(zchfAddr, FC_ABI, NODE_URL, pk);
    console.log("Minting Hub     : \t", mintingHubAddr);
    console.log("Frankencoin ZCHF: \t", zchfAddr);
    let reserve = await zchfContract.reserve();
    console.log("Reserve (=Equity): \t", reserve);
    
    //console.log(`Verify Equity:\nnpx hardhat verify --network sepolia ${reserve} ${zchfContract.address}`)
}

run();