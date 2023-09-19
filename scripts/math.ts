import { BigNumber } from "ethers";
import { ethers } from "hardhat";
export const DECIMALS = BigNumber.from(10).pow(BigNumber.from(18));

export function floatToDec18(x: any) {
  return ethers.utils.parseUnits(x.toString(), 18);
}

export function dec18ToFloat(x: any) {
  //x: BigNumber in Dec18 format to float
  let s = x.lt(0) ? -1 : 1;
  x = x.mul(s);
  let xInt = x.div(DECIMALS);
  let xDec = x.sub(xInt.mul(DECIMALS));
  let k = 18 - xDec.toString().length;
  let sPad = "0".repeat(k);
  let NumberStr = xInt.toString() + "." + sPad + xDec.toString();
  return parseFloat(NumberStr) * s;
}

export function divDec18(x: any, y: any) {
  return x.mul(DECIMALS).div(y);
}

export function mulDec18(x: any, y: any) {
  return x.mul(y).div(DECIMALS);
}
