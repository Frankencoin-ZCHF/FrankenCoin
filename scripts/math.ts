import { BigNumber } from "ethers";
const DECIMALS = BigNumber.from(10).pow(BigNumber.from(18));

export function floatToDec18(x) {
    // float number to dec 18
    if (x === 0) {
        return BigNumber.from(0);
    }
    let sg = Math.sign(x);
    x = Math.abs(x);
    let strX = x.toFixed(18);
    const arrX = strX.split(".");
    let xInt = BigNumber.from(arrX[0]);
    let xDec = BigNumber.from(arrX[1]);
    let xIntBig = xInt.mul(DECIMALS);
    return xIntBig.add(xDec).mul(sg);
}

export function dec18ToFloat(x) {
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


export function divDec18(x, y) {
    return x.mul(DECIMALS).div(y);
}

export function mulDec18(x, y) {
    return x.mul(y).div(DECIMALS);
}