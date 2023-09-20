import { ethers } from "hardhat";
export const DECIMALS = BigInt(10 ** 18);

export function floatToDec18(x: any) {
  return ethers.parseUnits(x.toString(), 18);
}

export function dec18ToFloat(x: bigint): bigint {
  return x / DECIMALS;
}

export function divDec18(x: any, y: any) {
  return x.mul(DECIMALS).div(y);
}

export function mulDec18(x: any, y: any) {
  return x.mul(y).div(DECIMALS);
}

export const abs = (n: bigint) => (n < 0n ? -n : n);
