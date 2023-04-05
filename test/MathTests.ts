// @ts-nocheck
import {expect} from "chai";
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
            let result = a/b;
            let fA = floatToDec18(a);
            let fB = floatToDec18(b);
            let fResult = await MathContract.divD18(fA, fB);
            let resultRec = dec18ToFloat(fResult);
            let err = Math.abs(result-resultRec);
            if (err>1e-12) {
                console.log("expected=", result);
                console.log("received=", resultRec);
                console.log("abs error=", err);
            }
            expect(err).to.be.lessThan(1e-12);
            
        });
        it("mul", async () => {
            let a = 1.5;
            let b = 0.4;
            let result = a*b;
            let fA = floatToDec18(a);
            let fB = floatToDec18(b);
            let fResult = await MathContract.mulD18(fA, fB);
            let resultRec = dec18ToFloat(fResult);
            let err = Math.abs(result-resultRec);
            if (err>1e-12) {
                console.log("expected=", result);
                console.log("received=", resultRec);
                console.log("abs error=", err);
            }
            expect(err).to.be.lessThan(1e-12);
        });
        it("pow3", async () => {
            let a = 1.5;
            let result = a**3;
            let fA = floatToDec18(a);
            let fResult = await MathContract.power3(fA);
            let resultRec = dec18ToFloat(fResult);
            let err = Math.abs(result-resultRec);
            if (err>1e-12) {
                console.log("expected=", result);
                console.log("received=", resultRec);
                console.log("abs error=", err);
            }
            expect(err).to.be.lessThan(1e-12);
            
        });
        it("cubic root", async () => {
            let numbers = [0.01, 0.9, 1, 1.5, 2, 10];
            for(var k = 0; k<numbers.length; k++) {
                let number = numbers[k];
                let result = number**(1/3);
                let fNumber = floatToDec18(number);
                let fResult = await MathContract.cubicRoot(fNumber);
                let resultRec = dec18ToFloat(fResult);
                let err = Math.abs(result-resultRec);
                if (err>1e-6) {
                    console.log("number =", result);
                    console.log("expected=", result);
                    console.log("received=", resultRec);
                    console.log("abs error=", err);
                }
                expect(err).to.be.lessThan(1e-6);
            }
        });
    });

});
