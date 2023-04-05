// @ts-nocheck
import {expect} from "chai";
import { floatToDec18, dec18ToFloat } from "../scripts/math";
const { ethers, network } = require("hardhat");
const BN = ethers.BigNumber;
import { createContract } from "../scripts/utils";

let ZCHFContract, equityContract, equityAddr, mintingHubContract, accounts;
let positionFactoryContract;
let mockXCHF, mockDCHF, bridge, bridgeSygnum;
let owner, sygnum;

describe("Plugin Veto Tests", () => {

    before(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0].address;
        sygnum = accounts[1].address;
        // create contracts
        ZCHFContract = await createContract("Frankencoin", [10 * 86_400]);
        equityAddr = ZCHFContract.reserve();
        equityContract = await ethers.getContractAt('Equity', equityAddr, accounts[0]);
        positionFactoryContract = await createContract("PositionFactory");
        mintingHubContract = await createContract("MintingHub", [ZCHFContract.address, positionFactoryContract.address]);
        // mocktoken
        mockXCHF = await createContract("TestToken", ["CryptoFranc", "XCHF", 18]);
        // mocktoken bridge to bootstrap
        let limit = floatToDec18(100_000);
        bridge = await createContract("StablecoinBridge", [mockXCHF.address, ZCHFContract.address, limit]);
        ZCHFContract.suggestMinter(bridge.address, 0, 0, "");
        // wait for 1 block
        await ethers.provider.send('evm_increaseTime', [60]); 
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
        // owner also mints some to be able to veto
        await mockXCHF.connect(accounts[0]).approve(bridge.address, amount);
        await bridge.connect(accounts[0])["mint(uint256)"](amount);
        
    });

    describe("create secondary bridge plugin", () => {
       
        
        it("create mock DCHF token&bridge", async () => {
            let limit : BigNumber = floatToDec18(100_000);
            mockDCHF = await createContract("TestToken", ["Test Name", "Symbol", 18]);
            await mockDCHF.mint(sygnum, floatToDec18(100_000));
            let otherAddr = mockDCHF.address;
            bridgeSygnum = await createContract("StablecoinBridge", [otherAddr, ZCHFContract.address, limit]);
        });
        it("Participant suggests minter", async () => {
            let applicationPeriod = await ZCHFContract.MIN_APPLICATION_PERIOD();
            let applicationFee = await ZCHFContract.MIN_FEE();
            let msg = "DCHF Bridge"
            await mockXCHF.connect(accounts[1]).approve(ZCHFContract.address, applicationFee);
            let balance = await ZCHFContract.balanceOf(accounts[1].address);
            expect(balance).to.be.greaterThan(applicationFee);
            await expect(ZCHFContract.connect(accounts[1]).suggestMinter(bridgeSygnum.address, applicationPeriod, 
                applicationFee, msg)).to.emit(ZCHFContract, "MinterApplied");
        });
        it("can't mint before min period", async () => {
            let amount = floatToDec18(1_000);
            await mockDCHF.connect(accounts[1]).approve(bridgeSygnum.address, amount);
            // set allowance
            await expect(bridgeSygnum.connect(accounts[1])["mint(uint256)"](amount)).to.be.revertedWithCustomError(ZCHFContract, "NotMinter");
        });
        it("deny minter", async () => {
            await expect(ZCHFContract.connect(accounts[0]).
                denyMinter(bridgeSygnum.address, [], "sygnum denied")).
                to.emit(ZCHFContract, "MinterDenied");
            await expect(bridgeSygnum.connect(accounts[1])["mint(uint256)"](floatToDec18(1_000))).
                to.be.revertedWithCustomError(ZCHFContract, "NotMinter");
        });
    });

});
