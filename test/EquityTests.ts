// @ts-nocheck
import {expect} from "chai";
import { floatToDec18, dec18ToFloat } from "../scripts/math";
const { ethers, bytes } = require("hardhat");
const BN = ethers.BigNumber;
import { createContract } from "../scripts/utils";

let zchf, bridge, xchf, equity;
let accounts, owner;

describe("Equity Tests", () => {
    
    before(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0].address;
        // create contracts
        xchf = await createContract("MockXCHFToken");
        zchf = await createContract("Frankencoin");
        let supply = floatToDec18(1000_000);
        bridge = await createContract("StablecoinBridge", [xchf.address, zchf.address, supply]);
        await zchf.suggestMinter(bridge.address, 0, 0, "");

        await xchf.mint(owner, supply);
        await xchf.connect(accounts[0]).approve(bridge.address, supply);
        await bridge.connect(accounts[0])["mint(uint256)"](supply);
        equity = await ethers.getContractAt("Equity", await zchf.reserve());
    });

    describe("basic initialization", () => {
        it("should have symbol ZCHF", async () => {
            let symbol = await zchf.symbol();
            expect(symbol).to.be.equal("ZCHF");
        });
        it("should have symbol FPS", async () => {
            let symbol = await equity.symbol();
            expect(symbol).to.be.equal("FPS");
        });
        it("should have some coins", async () => {
            let balance = await zchf.balanceOf(owner);
            expect(balance).to.be.equal(floatToDec18(1000_000));
        });
    });

    describe("minting shares", () => {
        it("should create an initial share", async () => {
            await zchf.transferAndCall(equity.address, floatToDec18(1), 0);
            let balance = await equity.balanceOf(owner);
            expect(balance).to.be.equal(floatToDec18(1));
        });
        it("should create one more share when adding seven capitl", async () => {
            let supply = await equity.totalSupply();
            let reserve = await zchf.equity();
            let test = await equity.check(floatToDec18(7));
            console.log("adding " + floatToDec18(7) + " capital to " + reserve + " should lead to " + test);
            let expected = await equity.calculateShares(floatToDec18(7));
            console.log("adding " + expected + " shares to " + supply + " supply");
            await zchf.transferAndCall(equity.address, floatToDec18(7), 0);
            let balance = await equity.balanceOf(owner);
            expect(balance).to.be.equal(floatToDec18(2));
        });
    });

});
