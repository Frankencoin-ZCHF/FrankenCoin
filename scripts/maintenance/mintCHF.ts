/*
    Script to mint mock XCHF
    1) set private key in terminal without 0x, via export PK="123cafefefefefeCACe..."
        minting will be done for that wallet
    2) edit script (addresses correct?)
    4) ts-node scripts/maintenance/mintCHF.ts
*/
const ethers = require("ethers");
import { SigningKey } from "@ethersproject/signing-key";
import { floatToDec18 } from "../math";
const NODE_URL = "https://rpc.sepolia.org";
const ERC20_ABI = require('../../abi/MockXCHFToken.json');
const BRIDGE_ABI = require('../../abi/StablecoinBridge.json');
const mockXCHFAddr = "0x20Ab5e22C812b51F29ADb70b467896f5338C7b97";
const mockVOLTknAddr = "0x894E14D5a7DDA4175E2A9EFee4B3bED6Dd930a98";
const bridgeAddr = "0x85C0CCbd95530e5d591d42E5C53302dcC97B180e";
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
    let amount = 10_000;
    const wallet = new ethers.Wallet(pk);
    let address = wallet.address;
    //let address = "0x71C696acd63979B39B8eD5b7a8030c46f34Da716"; // manu
    console.log("minting for ", address);
    //await mintMockVOLToken(amount, address);
    //await mintXCHF(amount, address);
    //await mintZCHF(amount);
}

start();