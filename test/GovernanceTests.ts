// @ts-nocheck
import {expect} from "chai";
const { ethers } = require("hardhat");
const BN = ethers.BigNumber;
import { createContract } from "../scripts/utils";

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

});
