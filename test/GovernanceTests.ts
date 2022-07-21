// @ts-nocheck
import {expect} from "chai";
import { floatToDec18 } from "../scripts/math";
const { ethers } = require("hardhat");
const BN = ethers.BigNumber;
import { createContract } from "../scripts/utils";
import { toDec18 } from "../scripts/utils";

let ZCHFContract, reservePoolContract, mintingHubContract, accounts;
let owner;

describe("TestTemplate", () => {

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
    });

});
