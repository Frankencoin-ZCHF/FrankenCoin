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
const mockXCHFAddr = "0xB6d3b7d819cDFf7dC6838349314D8d40C284B117";
const ZCHFAddr = "0x079909c5191fffF4AB4Ad7889B34821D4CE35f6b";

let pk: string | SigningKey = <string>process.env.PK;

export async function getSigningManagerFromPK(ctrAddr, ctrAbi, nodeUrl, pk) {
    const provider = new ethers.providers.JsonRpcProvider(nodeUrl);
    const wallet = new ethers.Wallet(pk);
    const signer = wallet.connect(provider);
    const signingContractManager = new ethers.Contract(ctrAddr, ctrAbi, signer);
    return signingContractManager;
}

// Total supply of pool share tokens
async function queryReservePoolShareSupply() {
    let ZCHFContract = await getSigningManagerFromPK(ZCHFAddr, ZCHF_ABI, NODE_URL, pk);
    let reserveAddress = await ZCHFContract.reserve();
    let equityContract = await getSigningManagerFromPK(reserveAddress, EQUITY_ABI, NODE_URL, pk);
    let fBalancePoolShareTokens = await equityContract.totalSupply();
    let supply = dec18ToFloat(fBalancePoolShareTokens);
    return supply;
}

// reserve pool size in ZCHF
async function queryTotalReserve() {
    //TODO
    let ZCHFContract = await getSigningManagerFromPK(ZCHFAddr, ZCHF_ABI, NODE_URL, pk);
    let reserveAddress = await ZCHFContract.reserve();
    let fReserveZCHF = await ZCHFContract.balanceOf(reserveAddress);
    let res = dec18ToFloat(fReserveZCHF);
    return res;
}

// reserve pool size in ZCHF relative to total supply
async function queryReserveRatio() {
    let ZCHFContract = await getSigningManagerFromPK(ZCHFAddr, ZCHF_ABI, NODE_URL, pk);
    let reserveZCHF = await queryTotalReserve();
    let fTotalSupplyZCHF = await ZCHFContract.totalSupply();
    let totalSupplyZCHF = dec18ToFloat(fTotalSupplyZCHF)
    let res = (reserveZCHF)/totalSupplyZCHF;
    return res;
}

async function queryReserveAddress() {
    let ZCHFContract = await getSigningManagerFromPK(ZCHFAddr, ZCHF_ABI, NODE_URL, pk);
    let reserveAddress = await ZCHFContract.reserve();
   
    return reserveAddress;
}

async function queryBorrowerReserve() {
    let ZCHFContract = await getSigningManagerFromPK(ZCHFAddr, ZCHF_ABI, NODE_URL, pk);
    let fReserve = await ZCHFContract.minterReserve();
    let res = dec18ToFloat(fReserve);
    return res;
}

async function queryShareholderReserve() {
    let ZCHFContract = await getSigningManagerFromPK(ZCHFAddr, ZCHF_ABI, NODE_URL, pk);
    let fReserve = await ZCHFContract.equity();
    let res = dec18ToFloat(fReserve);
    return res;
}

async function querySwapShareToZCHF(numShares) {
    let ZCHFContract = await getSigningManagerFromPK(ZCHFAddr, ZCHF_ABI, NODE_URL, pk);
    let reserveAddress = await ZCHFContract.reserve();
    let equityContract = await getSigningManagerFromPK(reserveAddress, EQUITY_ABI, NODE_URL, pk);
    let fZCHF = await equityContract.calculateProceeds(floatToDec18(numShares));
    let ZCHF = dec18ToFloat(fZCHF);
    return ZCHF;
}

async function querySwapZCHFToShares(numZCHF) {
    let ZCHFContract = await getSigningManagerFromPK(ZCHFAddr, ZCHF_ABI, NODE_URL, pk);
    let reserveAddress = await ZCHFContract.reserve();
    let equityContract = await getSigningManagerFromPK(reserveAddress, EQUITY_ABI, NODE_URL, pk);
    let fShares = await equityContract.calculateShares(floatToDec18(numZCHF));
    let shares = dec18ToFloat(fShares);
    return shares;
}

async function queryPrice() {
    let ZCHFContract = await getSigningManagerFromPK(ZCHFAddr, ZCHF_ABI, NODE_URL, pk);
    let reserveAddress = await ZCHFContract.reserve();
    let equityContract = await getSigningManagerFromPK(reserveAddress, EQUITY_ABI, NODE_URL, pk);
    let fprice = await equityContract.price();
    let price = dec18ToFloat(fprice);
    return price;
}

async function queryMarketCap() {
    let ZCHFContract = await getSigningManagerFromPK(ZCHFAddr, ZCHF_ABI, NODE_URL, pk);
    let reserveAddress = await ZCHFContract.reserve();
    let equityContract = await getSigningManagerFromPK(reserveAddress, EQUITY_ABI, NODE_URL, pk);
    let fprice = await equityContract.price();
    let price = Number((fprice).toString());
    let fTotalSupply = await equityContract.totalSupply();
    let res = dec18ToFloat(fTotalSupply) * price;
    return res;
}

async function start() {
    let supply = await queryReservePoolShareSupply();
    console.log("supply = ", supply, "RPS");

    let resAddr = await queryReserveAddress();
    console.log("Reserve (=Equity) address = ", resAddr);

    let totalReserve = await queryTotalReserve();
    console.log("Total outstanding ZCHF = ", totalReserve, "ZCHF");

    let borrowerReserve = await queryBorrowerReserve();
    console.log("Borrower reserve (=Equity) = ", borrowerReserve);

    let shareholderReserve = await queryShareholderReserve();
    console.log("Shareholder reserve (=Equity) = ", shareholderReserve);

    let reserveRatio = await queryReserveRatio();
    console.log("reserveRatio = ", reserveRatio * 100, "%");

    let price = await querySwapShareToZCHF(1);
    console.log("price sell 1 share = ZCHF ", price , "(1/x =", 1/price, ")");

    let numShares = await querySwapZCHFToShares(1);
    console.log("price sell 1 ZCHF = RPS ", numShares, "(1/x =", 1/numShares, ")" );

    let price0 = await queryPrice();
    console.log("price RPS = ZCHF ", price0);

    let mktCap = await queryMarketCap();
    console.log("Market Cap ZCHF ", mktCap);

}
start();