// @ts-nocheck
import {expect} from "chai";
import { floatToDec18, dec18ToFloat } from "../scripts/math";
const { ethers } = require("hardhat");
const BN = ethers.BigNumber;
import { createContract } from "../scripts/utils";

let ZCHFContract, reservePoolContract, mintingHubContract, accounts;
let owner;

describe("Basic Tests", () => {

    before(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0].address;
        // create contracts
        reservePoolContract= await createContract("ReservePool");
        ZCHFContract = await createContract("Frankencoin", [reservePoolContract.address]);
        mintingHubContract = await createContract("MintingHub", [ZCHFContract.address]);
    });

    describe("basic initialization", () => {
        it("symbol should be ZCHF", async () => {
            let symbol = await ZCHFContract.symbol();
            expect(symbol).to.be.equal("ZCHF");
        });
    });

    describe("mock bridge", () => {
        let mockXCHF;
        let bridge;
        it("create mock token", async () => {
            mockXCHF = await createContract("MockXCHFToken");
            let symbol = await mockXCHF.symbol();
            expect(symbol).to.be.equal("XCHF");
        });
        it("create mock stable coin bridge", async () => {
            let otherAddr = mockXCHF.address;
            let limit : BigNumber = floatToDec18(100_000);
            bridge = await createContract("StablecoinBridge", [otherAddr, ZCHFContract.address, limit]);
        });
        it("depositor of XCHF should receive ZCHF", async () => {
            let amount = floatToDec18(100);
            let tx1 = await mockXCHF.mint(owner, amount);
            let balanceBefore = await ZCHFContract.balanceOf(owner);
            let tx2 = await mockXCHF.connect(accounts[0]).transfer(bridge.address, amount);
            let balanceXCHFOfBridge = await mockXCHF.balanceOf(bridge.address);
            let balanceAfter = await ZCHFContract.balanceOf(owner);
            let ZCHFReceived = dec18ToFloat(balanceAfter.sub(balanceBefore));
            let isBridgeBalanceCorrect = dec18ToFloat(balanceXCHFOfBridge)==100;
            let isSenderBalanceCorrect = ZCHFReceived==100;
            if (!isBridgeBalanceCorrect || !isSenderBalanceCorrect) {
                console.log("Bridge received XCHF tokens expected 100 = ", dec18ToFloat(balanceXCHFOfBridge));
                console.log("Sender received ZCH tokens expected 100 = ", ZCHFReceived);
                expect(isBridgeBalanceCorrect).to.be.true;
                expect(isSenderBalanceCorrect).to.be.true;
            }
            
        });
    });

});
