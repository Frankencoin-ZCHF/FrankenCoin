// @ts-nocheck
import {expect} from "chai";
const { ethers } = require("hardhat");
const BN = ethers.BigNumber;

describe("TestTemplate", () => {

    before(async () => {
        // do something
    });

    describe("setWhitelistActive", () => {
        /*
        it("should fail if not an owner", async () => {
            await expect(
                manager.connect(accounts[1]).setWhitelistActive(true)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should set flag", async () => {
            let isWhitelistActive = await manager.isWhitelistActive();
            expect(isWhitelistActive).to.be.false;

            await manager.setWhitelistActive(true);
            isWhitelistActive = await manager.isWhitelistActive();
            expect(isWhitelistActive).to.be.true;

            await manager.setWhitelistActive(false);
            isWhitelistActive = await manager.isWhitelistActive();
            expect(isWhitelistActive).to.be.false;
        });
        */
    });

});
