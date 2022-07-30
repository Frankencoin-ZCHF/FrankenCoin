#!/usr/bin/node
/*
    Script to mint moch XCHF
    1) set private key in terminal without 0x, via export PK="123cafefefefefeCACe..."
    2) edit script
    4) ts-node scripts/maintenance/mintXCHF.ts
*/
const ethers = require("ethers");
import { SigningKey } from "@ethersproject/signing-key";
import { floatToDec18 } from "../math";
const NODE_URL = "https://rpc.sepolia.org";
const ERC20_ABI = require('../../abi/MockXCHFToken.json');

let pk: string | SigningKey = <string>process.env.PK;

export async function getSigningManagerFromPK(ctrAddr, ctrAbi, nodeUrl, pk) {
    const provider = new ethers.providers.JsonRpcProvider(nodeUrl);
    const wallet = new ethers.Wallet(pk);
    const signer = wallet.connect(provider);
    const signingContractManager = new ethers.Contract(ctrAddr, ctrAbi, signer);
    return signingContractManager;
}

async function mint(address, amount : number) {
    const mockXCHFAddr = "0x4bfc8c42362C7626D0555cA273Cc12c1580E8A2d";
    let tokenContract = await getSigningManagerFromPK(mockXCHFAddr, ERC20_ABI, NODE_URL, pk);
    await tokenContract.mint(address, floatToDec18(amount));
}

async function start() {
    let amount = 1000;
    let mintForAddress = "0x0aB6527027EcFF1144dEc3d78154fce309ac838c";
    await mint(mintForAddress, amount);
}

start();