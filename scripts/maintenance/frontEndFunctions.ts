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
const dEURO_ABI = require('../../abi/DecentralizedEURO.json');
const EQUITY_ABI = require('../../abi/Equity.json');

const BRIDGE_ABI = require('../../abi/StablecoinBridge.json');
const mockXEURAddr = "0xB6d3b7d819cDFf7dC6838349314D8d40C284B117";
const dEUROAddr = "0x079909c5191fffF4AB4Ad7889B34821D4CE35f6b";

let pk: string | SigningKey = <string>process.env.PK;

export async function getSigningManagerFromPK(ctrAddr: string, ctrAbi: string, nodeUrl: string, pk: any) {
    const provider = new ethers.providers.JsonRpcProvider(nodeUrl);
    const wallet = new ethers.Wallet(pk);
    const signer = wallet.connect(provider);
    const signingContractManager = new ethers.Contract(ctrAddr, ctrAbi, signer);
    return signingContractManager;
}

// Total supply of pool share tokens
async function queryReservePoolShareSupply(): Promise<bigint> {
    let dEUROContract = await getSigningManagerFromPK(dEUROAddr, dEURO_ABI, NODE_URL, pk);
    let reserveAddress = await dEUROContract.reserve();
    let equityContract = await getSigningManagerFromPK(reserveAddress, EQUITY_ABI, NODE_URL, pk);
    let fBalancePoolShareTokens = await equityContract.totalSupply();
    let supply = dec18ToFloat(fBalancePoolShareTokens);
    return supply;
}

// reserve pool size in dEURO
async function queryTotalReserve(): Promise<bigint> {
    //TODO
    let dEUROContract = await getSigningManagerFromPK(dEUROAddr, dEURO_ABI, NODE_URL, pk);
    let reserveAddress = await dEUROContract.reserve();
    let fReservedEURO = await dEUROContract.balanceOf(reserveAddress);
    let res = dec18ToFloat(fReservedEURO);
    return res;
}

// reserve pool size in dEURO relative to total supply
async function queryReserveRatio(): Promise<bigint> {
    let dEUROContract = await getSigningManagerFromPK(dEUROAddr, dEURO_ABI, NODE_URL, pk);
    let reservedEURO = await queryTotalReserve();
    let fTotalSupplydEURO = await dEUROContract.totalSupply();
    let totalSupplydEURO = dec18ToFloat(fTotalSupplydEURO)
    let res = (reservedEURO)/totalSupplydEURO;
    return res;
}

async function queryReserveAddress(): Promise<bigint> {
    let dEUROContract = await getSigningManagerFromPK(dEUROAddr, dEURO_ABI, NODE_URL, pk);
    let reserveAddress = await dEUROContract.reserve();
   
    return reserveAddress;
}

async function queryBorrowerReserve(): Promise<bigint> {
    let dEUROContract = await getSigningManagerFromPK(dEUROAddr, dEURO_ABI, NODE_URL, pk);
    let fReserve = await dEUROContract.minterReserve();
    let res = dec18ToFloat(fReserve);
    return res;
}

async function queryShareholderReserve(): Promise<bigint> {
    let dEUROContract = await getSigningManagerFromPK(dEUROAddr, dEURO_ABI, NODE_URL, pk);
    let fReserve = await dEUROContract.equity();
    let res = dec18ToFloat(fReserve);
    return res;
}

async function querySwapShareTodEURO(numShares: number): Promise<bigint> {
    let dEUROContract = await getSigningManagerFromPK(dEUROAddr, dEURO_ABI, NODE_URL, pk);
    let reserveAddress = await dEUROContract.reserve();
    let equityContract = await getSigningManagerFromPK(reserveAddress, EQUITY_ABI, NODE_URL, pk);
    let fdEURO = await equityContract.calculateProceeds(floatToDec18(numShares));
    let dEURO = dec18ToFloat(fdEURO);
    return dEURO;
}

async function querySwapdEUROToShares(numdEURO: number): Promise<bigint> {
    let dEUROContract = await getSigningManagerFromPK(dEUROAddr, dEURO_ABI, NODE_URL, pk);
    let reserveAddress = await dEUROContract.reserve();
    let equityContract = await getSigningManagerFromPK(reserveAddress, EQUITY_ABI, NODE_URL, pk);
    let fShares = await equityContract.calculateShares(floatToDec18(numdEURO));
    let shares = dec18ToFloat(fShares);
    return shares;
}

async function queryPrice(): Promise<bigint> {
    let dEUROContract = await getSigningManagerFromPK(dEUROAddr, dEURO_ABI, NODE_URL, pk);
    let reserveAddress = await dEUROContract.reserve();
    let equityContract = await getSigningManagerFromPK(reserveAddress, EQUITY_ABI, NODE_URL, pk);
    let fprice = await equityContract.price();
    let price = dec18ToFloat(fprice);
    return price;
}

async function queryMarketCap(): Promise<bigint> {
    let dEUROContract = await getSigningManagerFromPK(dEUROAddr, dEURO_ABI, NODE_URL, pk);
    let reserveAddress = await dEUROContract.reserve();
    let equityContract = await getSigningManagerFromPK(reserveAddress, EQUITY_ABI, NODE_URL, pk);
    let fprice = await equityContract.price();
    let price = Number((fprice).toString());
    let fTotalSupply = await equityContract.totalSupply();
    let res = dec18ToFloat(fTotalSupply) * BigInt(price);
    return res;
}

async function start() {
    let supply = await queryReservePoolShareSupply();
    console.log("supply = ", supply, "RPS");

    let resAddr = await queryReserveAddress();
    console.log("Reserve (=Equity) address = ", resAddr);

    let totalReserve = await queryTotalReserve();
    console.log("Total outstanding dEURO = ", totalReserve, "dEURO");

    let borrowerReserve = await queryBorrowerReserve();
    console.log("Borrower reserve (=Equity) = ", borrowerReserve);

    let shareholderReserve = await queryShareholderReserve();
    console.log("Shareholder reserve (=Equity) = ", shareholderReserve);

    let reserveRatio = await queryReserveRatio();
    console.log("reserveRatio = ", reserveRatio * 100n, "%");

    let price = await querySwapShareTodEURO(1);
    console.log("price sell 1 share = dEURO ", price , "(1/x =", 1n/price, ")");

    let numShares = await querySwapdEUROToShares(1);
    console.log("price sell 1 dEURO = RPS ", numShares, "(1/x =", 1n/numShares, ")" );

    let price0 = await queryPrice();
    console.log("price RPS = dEURO ", price0);

    let mktCap = await queryMarketCap();
    console.log("Market Cap dEURO ", mktCap);

}
start();