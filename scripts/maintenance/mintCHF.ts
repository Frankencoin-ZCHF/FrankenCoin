/*
    Script to mint mock XCHF
    1) set private key in terminal without 0x, via export PK="123cafefefefefeCACe..."
        minting will be done for that wallet
    2) edit script
    4) ts-node scripts/maintenance/mintCHF.ts
*/
const ethers = require("ethers");
import { SigningKey } from "@ethersproject/signing-key";
import { floatToDec18 } from "../math";
const NODE_URL = "https://rpc.sepolia.org";
const ERC20_ABI = require('../../abi/MockXCHFToken.json');
const BRIDGE_ABI = require('../../abi/StablecoinBridge.json');
const mockXCHFAddr = "0x081AEb4c123DF59a31890E038A1cCCAa32F41616";
const mockVOLTknAddr = "0xf18b58536ab9c71e54ED2eF4485B3f2cDaD3C172";
const bridgeAddr = "0x8f8dE84f9bE411e080A77512cC50CF8A3a1051c4";
let pk: string | SigningKey = <string>process.env.PK;

export async function getSigningManagerFromPK(ctrAddr, ctrAbi, nodeUrl, pk) {
    const provider = new ethers.providers.JsonRpcProvider(nodeUrl);
    const wallet = new ethers.Wallet(pk);
    const signer = wallet.connect(provider);
    const signingContractManager = new ethers.Contract(ctrAddr, ctrAbi, signer);
    return signingContractManager;
}

async function mintXCHF(amount : number, address : string) {
    const wallet = new ethers.Wallet(pk);
    
    let tokenContract = await getSigningManagerFromPK(mockXCHFAddr, ERC20_ABI, NODE_URL, pk);
    await tokenContract.mint(address, floatToDec18(amount));
}

async function mintMockVOLToken(amount : number, address : string) {
    const wallet = new ethers.Wallet(pk);
    let tokenContract = await getSigningManagerFromPK(mockVOLTknAddr, ERC20_ABI, NODE_URL, pk);
    await tokenContract.mint(address, floatToDec18(amount));
}

async function mintZCHF(amount : number) {
    let dAmount = floatToDec18(amount);
    let tokenContract = await getSigningManagerFromPK(mockXCHFAddr, ERC20_ABI, NODE_URL, pk);
    let bridgeContract = await getSigningManagerFromPK(bridgeAddr, BRIDGE_ABI, NODE_URL, pk);
    await tokenContract.approve(bridgeAddr, dAmount);
    let tx = await bridgeContract["mint(uint256)"](dAmount);
    console.log("minted XCHF:", tx.hash);
}

async function start() {
    let amount = 10;
    const wallet = new ethers.Wallet(pk);
    let address = wallet.address;
    //let address = "0x71C696acd63979B39B8eD5b7a8030c46f34Da716"; // manu
    //await mintMockVOLToken(amount, address);
    //await mintXCHF(amount, address);
    //await mintZCHF(amount);
}

start();