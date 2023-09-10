// @ts-nocheck
import { expect } from "chai";
import { floatToDec18, dec18ToFloat } from "../scripts/math";
const { ethers, bytes } = require("hardhat");
const BN = ethers.BigNumber;
import { createContract } from "../scripts/utils";

let MathContract;
let owner, accounts;

describe("Math Tests", () => {

    before(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0].address;
        // create contracts
        MathContract = await createContract("TestMathUtil");
    });

    describe("math", () => {
        it("div", async () => {
            let a = 1.5;
            let b = 0.4;
            let result = a / b;
            let fA = floatToDec18(a);
            let fB = floatToDec18(b);
            let fResult = await MathContract.divD18(fA, fB);
            let resultRec = dec18ToFloat(fResult);
            let err = Math.abs(result - resultRec);
            if (err > 1e-12) {
                console.log("expected=", result);
                console.log("received=", resultRec);
                console.log("abs error=", err);
            }
            expect(err).to.be.lessThan(1e-12);

        });
        it("mul", async () => {
            let a = 1.5;
            let b = 0.4;
            let result = a * b;
            let fA = floatToDec18(a);
            let fB = floatToDec18(b);
            let fResult = await MathContract.mulD18(fA, fB);
            let resultRec = dec18ToFloat(fResult);
            let err = Math.abs(result - resultRec);
            if (err > 1e-12) {
                console.log("expected=", result);
                console.log("received=", resultRec);
                console.log("abs error=", err);
            }
            expect(err).to.be.lessThan(1e-12);
        });
        it("pow3", async () => {
            let a = 1.5;
            let result = a ** 3;
            let fA = floatToDec18(a);
            let fResult = await MathContract.power3(fA);
            let resultRec = dec18ToFloat(fResult);
            let err = Math.abs(result - resultRec);
            if (err > 1e-12) {
                console.log("expected=", result);
                console.log("received=", resultRec);
                console.log("abs error=", err);
            }
            expect(err).to.be.lessThan(1e-12);

        });
        it("cubic root", async () => {
            // let numbers = [0.01, 0.9, 1, 1.5, 2, 10];
            let numbers = [1000000000000, 1, 1.01, 1.0002, 1.000003, 1.00000005];
            for (var k = 0; k < numbers.length; k++) {
                let number = numbers[k];
                let result = number ** (1 / 3);
                let fNumber = floatToDec18(number);
                let tx = await MathContract.cubicRoot(fNumber, true);
                expect(tx).to.not.be.reverted;
                let fResult = await MathContract.result();
                let resultRec = dec18ToFloat(fResult);
                // console.log(resultRec);
                let err = Math.abs((result - resultRec)/result);
                if (err > 1e-12) {
                    console.log("number =", result);
                    console.log("expected=", result);
                    console.log("received=", resultRec);
                    console.log("rel error=", err);
                }
                expect(err).to.be.lessThan(1e-12);
            }
        });

        it("total shares", async () => {
            let totalShares = floatToDec18(10000);
            let capitalBefore = floatToDec18(1000000000000);  // 1000 billion
            let numbers = [7000000000000, 1000, 100, 10, 1, 0.1, 0.01, 0.001, 0.0001, 0.00001];
            for (var k = 0; k < numbers.length; k++) {
                let fNumber = floatToDec18(numbers[k]);
                let fResult = await MathContract.calculateShares(totalShares, capitalBefore, fNumber);
                //console.log(fResult);
                let resultRec = dec18ToFloat(fResult);
                // console.log(resultRec);
                expect(resultRec).to.be.above(0);
            }
        });
    });

});
