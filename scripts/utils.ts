import { ethers } from "hardhat";

let defaultSigner: String;

export function setDefaultSigner(signer: String) {
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

export async function createFactory(path: string) {
  const parsed = {};
  return await ethers.getContractFactory(path, { libraries: parsed });
}

export async function createContract(path: string, args: any[] = []) {
  const factory = await createFactory(path);
  return await factory.deploy(...args);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getSigningManagerFromPK(
  ctrAddr: string,
  ctrAbi: string,
  nodeUrl: string,
  pk: any
) {
  const provider = new ethers.providers.JsonRpcProvider(nodeUrl);
  const wallet = new ethers.Wallet(pk);
  const signer = wallet.connect(provider);
  const signingContractManager = new ethers.Contract(ctrAddr, ctrAbi, signer);
  return signingContractManager;
}

export function capitalToShares(
  totalCapital: bigint,
  totalShares: bigint,
  dCapital: bigint
): bigint {
  if (totalShares == 0n) {
    return 1000n;
  } else {
    return (
      totalShares *
      (((totalCapital + dCapital) / totalCapital) ** (1n / 3n) - 1n)
    );
  }
}
export function sharesToCapital(
  totalCapital: bigint,
  totalShares: bigint,
  dShares: bigint
) {
  return -totalCapital * (((totalShares - dShares) / totalShares) ** 3n - 1n);
}
