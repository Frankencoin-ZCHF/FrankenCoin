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
const NODE_URL = "https://rpc-sepolia.rockx.com";//https://rpc.sepolia.org";
const ERC20_ABI = require('../../abi/MockXCHFToken.json');
//const FC_ABI = require('../../abi/Frankencoin.json');
const BRIDGE_ABI = require('../../abi/StablecoinBridge.json');
const mockXCHFAddr = "0xB6d3b7d819cDFf7dC6838349314D8d40C284B117";
const mockVOLTknAddr = "0xC5Bdf340EE520965b0B8BeAA85B6bDbf90d5b277";
const bridgeAddr = "0x85DbAfAc987B1e8D58058680976E1c6D609b3C37";
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
    // mint ZCHF via XCHF bridge
    let dAmount = floatToDec18(amount);
    let tokenContract = await getSigningManagerFromPK(mockXCHFAddr, ERC20_ABI, NODE_URL, pk);
    let bridgeContract = await getSigningManagerFromPK(bridgeAddr, BRIDGE_ABI, NODE_URL, pk);
    await tokenContract.approve(bridgeAddr, dAmount);
    let tx = await bridgeContract["mint(uint256)"](dAmount);
    console.log("minted ZCHF:", tx.hash);
}

async function start() {
    let amount = 10_000;
    const wallet = new ethers.Wallet(pk);
    let address = wallet.address;
    //let address = "0x71C696acd63979B39B8eD5b7a8030c46f34Da716"; // manu
    console.log("minting for ", address);
    
    //let zchfContract = await getSigningManagerFromPK("0xC578aC4f81112a87FD6eec13aE6e2C4d17129D4a", FC_ABI, NODE_URL, pk);
    // create a minting hub too while we have no ZCHF supply
    /*let tx = await zchfContract.suggestMinter("0x240b812F8B8E42b623E00707A12150FF7cE2d72F", 
        901, floatToDec18(1000), "Minting Hub",  { gasLimit: 2_000_000 });
    await tx.wait();
    console.log(tx);*/

    //await mintMockVOLToken(amount, address);
    //await mintXCHF(amount, address);
    await mintZCHF(amount);
}

start();