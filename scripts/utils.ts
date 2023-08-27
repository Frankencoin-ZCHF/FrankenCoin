const { ethers } = require("hardhat");
import { BigNumber } from "ethers";

export function toWei(n : BigNumber) {
    return ethers.utils.parseEther(n);
}
export function fromWei(n: any) {
    return ethers.utils.formatEther(n);
}
export function toBytes32(s: any) {
    return ethers.utils.formatBytes32String(s);
}
export function fromBytes32(s: any) {
    return ethers.utils.parseBytes32String(s);
}

let defaultSigner : String;

export function setDefaultSigner(signer : String) {
    defaultSigner = signer;
}

export async function getAccounts(): Promise<any[]> {
    const accounts = await ethers.getSigners();
    const users: any = [];
    accounts.forEach((element: any) => {
        users.push(element.address);
    });
    return accounts;
}

export async function createFactory(path: String) {
    const parsed = {};
    return await ethers.getContractFactory(path, { libraries: parsed });
}

export async function createContract(path: String, args = []) {
    const factory = await createFactory(path);
    if (defaultSigner != null) {
        return await factory.connect(defaultSigner).deploy(...args);
    } else {
        return await factory.deploy(...args);
    }
}

export function sleep(ms : number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}


export async function getSigningManagerFromPK(ctrAddr: string, ctrAbi: string, nodeUrl: string, pk: any) {
    const provider = new ethers.providers.JsonRpcProvider(nodeUrl);
    const wallet = new ethers.Wallet(pk);
    const signer = wallet.connect(provider);
    const signingContractManager = new ethers.Contract(ctrAddr, ctrAbi, signer);
    return signingContractManager;
}