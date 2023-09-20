import { expect } from "chai";
import { floatToDec18, abs } from "../scripts/math";
import { TestMathUtil } from "../typechain";
import { ethers } from "hardhat";

describe("Math Tests", () => {
  let MathContract: TestMathUtil;

  before(async () => {
    const factory = await ethers.getContractFactory("TestMathUtil");
    MathContract = await factory.deploy();
  });

  describe("math", () => {
    it("div", async () => {
      let a = 1.5;
      let b = 0.4;
      let result = a / b;
      let fA = floatToDec18(a);
      let fB = floatToDec18(b);
      let fResult = await MathContract.divD18(fA, fB);
      let err = abs(floatToDec18(result) - fResult);
      if (err > BigInt(10e6)) {
        console.log("expected=", result);
        console.log("received=", fResult);
        console.log("abs error=", err);
      }
      expect(err).to.be.lessThan(BigInt(10e6));
    });
    it("mul", async () => {
      let a = 1.5;
      let b = 0.4;
      let result = a * b;
      let fA = floatToDec18(a);
      let fB = floatToDec18(b);
      let fResult = await MathContract.mulD18(fA, fB);
      let err = abs(floatToDec18(result) - fResult);
      if (err > BigInt(1e6)) {
        console.log("expected=", result);
        console.log("received=", fResult);
        console.log("abs error=", err);
      }
      expect(err).to.be.lessThan(BigInt(10e6));
    });
    it("pow3", async () => {
      let a = 1.5;
      let result = a ** 3;
      let fA = floatToDec18(a);
      let fResult = await MathContract.power3(fA);
      let err = abs(floatToDec18(result) - fResult);
      if (err > BigInt(10e6)) {
        console.log("expected=", result);
        console.log("received=", fResult);
        console.log("abs error=", err);
      }
      expect(err).to.be.lessThan(BigInt(10e6));
    });
    it("cubic root", async () => {
      // let numbers = [0.01, 0.9, 1, 1.5, 2, 10];
      let numbers = [1000000000000, 1, 1.01, 1.0002, 1.000003, 1.00000005];
      for (var k = 0; k < numbers.length; k++) {
        let number = numbers[k];
        let result = number ** (1 / 3);
        let fNumber = floatToDec18(number);
        let tx = await MathContract.cubicRoot(fNumber, true);
        await expect(tx).to.not.be.reverted;
        let fResult = await MathContract.result();
        // console.log(resultRec);
        let err = abs(floatToDec18(result) - fResult);
        if (err > BigInt(10e6)) {
          console.log("expected=", result);
          console.log("received=", fResult);
          console.log("rel error=", err);
        }
        expect(err).to.be.lessThan(BigInt(10e6));
      }
    });

    it("total shares", async () => {
      let totalShares = floatToDec18(10000);
      let capitalBefore = floatToDec18(1000000000000); // 1000 billion
      let numbers = [
        7000000000000, 1000, 100, 10, 1, 0.1, 0.01, 0.001, 0.0001, 0.00001,
      ];
      for (var k = 0; k < numbers.length; k++) {
        let fNumber = floatToDec18(numbers[k]);
        let fResult = await MathContract.calculateShares(
          totalShares,
          capitalBefore,
          fNumber
        );
        expect(fResult).to.be.above(0n);
      }
    });
  });
});
