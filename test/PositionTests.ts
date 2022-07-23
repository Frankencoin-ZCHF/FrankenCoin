// @ts-nocheck
import {expect} from "chai";
import { floatToDec18, dec18ToFloat } from "../scripts/math";
const { ethers, bytes } = require("hardhat");
const BN = ethers.BigNumber;
import { createContract } from "../scripts/utils";

let ZCHFContract, reservePoolContract, mintingHubContract, accounts;
let mockXCHF, mockVOL, bridge;
let owner, sygnum;

describe("Position Tests", () => {

    before(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0].address;
        sygnum = accounts[1].address;
        // create contracts
        reservePoolContract= await createContract("ReservePool");
        ZCHFContract = await createContract("Frankencoin", [reservePoolContract.address]);
        await reservePoolContract.initialize(ZCHFContract.address);
        mintingHubContract = await createContract("MintingHub", [ZCHFContract.address]);
        // mocktoken
        mockXCHF = await createContract("MockXCHFToken");
        // mocktoken bridge to bootstrap
        let limit = floatToDec18(100_000);
        bridge = await createContract("StablecoinBridge", [mockXCHF.address, ZCHFContract.address, limit]);
        ZCHFContract.suggestMinter(bridge.address, 0, 0, "XCHF Bridge");
        // create a minting hub too while it's still free (no ZCHF supply)
        ZCHFContract.suggestMinter(mintingHubContract.address, 0, 0, "Minting Hub");
        // wait for 1 block
        await hre.ethers.provider.send('evm_increaseTime', [60]); 
        await network.provider.send("evm_mine");
        // now we are ready to bootstrap ZCHF with Mock-XCHF
        await mockXCHF.mint(owner, limit.div(2));
        await mockXCHF.mint(sygnum, limit.div(2));
        let balance = await mockXCHF.balanceOf(sygnum);
        expect(balance).to.be.equal(limit.div(2));
        // mint some ZCHF to block bridges without veto
        let amount = floatToDec18(20_000);
        await mockXCHF.connect(accounts[1]).approve(bridge.address, amount);
        await bridge.connect(accounts[1])["mint(uint256)"](amount);
        // owner mints some to be able to create a position
        await mockXCHF.connect(accounts[0]).approve(bridge.address, amount);
        await bridge.connect(accounts[0])["mint(uint256)"](amount);
        // vol tokens
        mockVOL = await createContract("MockVOLToken");
        amount = floatToDec18(500_000);
        await mockVOL.mint(owner, amount);
        
    });

    describe("use Minting Hub", () => {
        let positionAddr, positionContract;

        it("create position", async () => {
            let collateral = mockVOL.address;
            let initialLimit = floatToDec18(110_000);
            let initialCollateral = floatToDec18(120_000);
            let duration = BN.from(7*86_400);
            let fees = BN.from(0.01 * 1000_000);
            let reserve = BN.from(0.10 * 1000_000);
            let openingFeeZCHF = await mintingHubContract.OPENING_FEE();
            await mockVOL.connect(accounts[0]).approve(mintingHubContract.address, initialCollateral);
            await ZCHFContract.connect(accounts[0]).approve(mintingHubContract.address, openingFeeZCHF);
            // to get the return value we add callStatic to the call, otherwise we get the transaction
            positionAddr = await mintingHubContract.callStatic.openPosition(collateral, initialCollateral, 
                initialLimit, duration, fees, reserve);
            positionContract = await hre.ethers.getContractAt("Position", positionAddr);
            console.log("done")
        });
        it("get loan", async () => {
            //todo
            //let amount = floatToDec18(10_000);
            //let tx = await positionContract.limit(); //mint(accounts[0].owner, amount);

        });

        
    });

});
