// @ts-nocheck
import {expect} from "chai";
import { floatToDec18, dec18ToFloat } from "../scripts/math";
const { ethers, bytes } = require("hardhat");
const BN = ethers.BigNumber;
import { createContract } from "../scripts/utils";

let ZCHFContract, mintingHubContract, positionFactoryContract, equityAddr, equityContract, accounts;
let owner;

describe("Basic Tests", () => {
    
    before(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0].address;
        // create contracts
        ZCHFContract = await createContract("Frankencoin");
        equityAddr = ZCHFContract.reserve();
        equityContract = await ethers.getContractAt('Equity', equityAddr, accounts[0]);
        positionFactoryContract = await createContract("PositionFactory");
        mintingHubContract = await createContract("MintingHub", [ZCHFContract.address, positionFactoryContract.address]);
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
        it("minting fails if not approved", async () => {
            let amount = floatToDec18(100);
            let tx1 = await mockXCHF.mint(owner, amount);
            let balanceBefore = await ZCHFContract.balanceOf(owner);
            await mockXCHF.connect(accounts[0]).approve(bridge.address, amount);
            // set allowance
            await expect(bridge.connect(accounts[0])["mint(uint256)"](amount)).to.be.revertedWith("not approved minter");
        });
        it("bootstrap suggestMinter", async () => {
            let applicationPeriod = BN.from(0);
            let applicationFee = BN.from(0);
            let msg = "XCHF Bridge"
            await expect(ZCHFContract.suggestMinter(bridge.address, applicationPeriod, 
                applicationFee, msg)).to.emit(ZCHFContract, "MinterApplied");
            // increase block to be a minter
            await hre.ethers.provider.send('evm_increaseTime', [60]); 
            await network.provider.send("evm_mine") 
            let isMinter = await ZCHFContract.isMinter(bridge.address);
            expect(isMinter).to.be.true;
        });

        it("minter of XCHF-bridge should receive ZCHF", async () => {
            let amount = floatToDec18(100);
            let balanceBefore = await ZCHFContract.balanceOf(owner);
            // set allowance
            await mockXCHF.connect(accounts[0]).approve(bridge.address, amount);
            // https://stackoverflow.com/questions/70364713/hardhat-test-functionname-is-not-a-function
            // if you declared two mint functions then you have to explicitly use the fully qualified signature
            let tx2 = await bridge.connect(accounts[0])["mint(uint256)"](amount);
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
        it("burner of XCHF-bridge should receive XCHF", async () => {
            let amount = floatToDec18(50);
            let balanceBefore = await ZCHFContract.balanceOf(owner);
            let balanceXCHFBefore = await mockXCHF.balanceOf(owner);
            // set allowance
            //await mockXCHF.connect(accounts[0]).approve(bridge.address, amount);
            let tx2 = await bridge.connect(accounts[0])["burn(uint256)"](amount);
            let balanceXCHFOfBridge = await mockXCHF.balanceOf(bridge.address);
            let balanceXCHFAfter = await mockXCHF.balanceOf(owner);
            let balanceAfter = await ZCHFContract.balanceOf(owner);
            let ZCHFReceived = dec18ToFloat(balanceAfter.sub(balanceBefore));
            let XCHFReceived = dec18ToFloat(balanceXCHFAfter.sub(balanceXCHFBefore));
            let isBridgeBalanceCorrect = dec18ToFloat(balanceXCHFOfBridge)==50;
            let isSenderBalanceCorrect = ZCHFReceived==-50;
            let isXCHFBalanceCorrect = XCHFReceived==50;
            if (!isBridgeBalanceCorrect || !isSenderBalanceCorrect || !isXCHFBalanceCorrect) {
                console.log("Bridge balance XCHF tokens expected 50 = ", dec18ToFloat(balanceXCHFOfBridge));
                console.log("Sender burned ZCH tokens expected 50 = ", -ZCHFReceived);
                console.log("Sender received XCHF tokens expected 50 = ", XCHFReceived);
                expect(isBridgeBalanceCorrect).to.be.true;
                expect(isSenderBalanceCorrect).to.be.true;
                expect(isXCHFBalanceCorrect).to.be.true;
            }
        });
        function capitalToShares(totalCapital, totalShares, dCapital) {
            let delta = 0;
            if (totalShares==0) {
                dCapital = dCapital - 1;
                totalShares = 1;
                totalCapital= 1;
                delta = 1;
            }
            return totalShares *( ((totalCapital +dCapital)/totalCapital)**(1/3) - 1 ) + delta;
        }
        it("deposit XCHF to reserve pool and receive share tokens", async () => {
            let amount = 25;// amount we will deposit
            let fAmount = floatToDec18(25);// amount we will deposit
            let balanceBefore = await equityContract.balanceOf(owner);
            let balanceBeforeZCHF = await ZCHFContract.balanceOf(owner);
            let fTotalShares = await equityContract.totalSupply();
            let fTotalCapital = await ZCHFContract.balanceOf(equityAddr);
            // calculate shares we receive according to pricing function:
            let totalShares = dec18ToFloat(fTotalShares);
            let totalCapital = dec18ToFloat(fTotalCapital);
            let dShares = capitalToShares(totalCapital, totalShares, amount);
            //console.log("owner = ", owner);
            await ZCHFContract.transferAndCall(equityContract.address, fAmount, 0);
            let balanceAfter = await equityContract.balanceOf(owner);
            let balanceAfterZCHF = await ZCHFContract.balanceOf(owner);
            let poolTokenShares = dec18ToFloat(balanceAfter.sub(balanceBefore));
            let ZCHFReceived = dec18ToFloat(balanceAfterZCHF.sub(balanceBeforeZCHF));
            let isPoolShareAmountCorrect = Math.abs(poolTokenShares-dShares) < 1e-12;
            let isSenderBalanceCorrect = ZCHFReceived==-25;
            if(!isPoolShareAmountCorrect || !isSenderBalanceCorrect) {
                console.log("Pool token shares received = ", poolTokenShares);
                console.log("ZCHF tokens deposited = ", -ZCHFReceived);
                expect(isPoolShareAmountCorrect).to.be.true;
                expect(isSenderBalanceCorrect).to.be.true;
            }

        });
        it("redeem shares", async () => {
            let balance = await equityContract.redeemableBalance(owner);
            expect(balance).to.be.equal(floatToDec18(25));
            let amountD18 = floatToDec18(25);
            let balanceBefore = await reservePoolContract.balanceOf(owner);
            let balanceBeforeZCHF = await ZCHFContract.balanceOf(owner); 
            await reservePoolContract.redeem(amountD18);
            let balanceAfter = await reservePoolContract.balanceOf(owner);
            let balanceAfterZCHF = await ZCHFContract.balanceOf(owner);
            
            let poolTokenSharesRec = dec18ToFloat(balanceAfter.sub(balanceBefore));
            let ZCHFReceived = dec18ToFloat(balanceAfterZCHF.sub(balanceBeforeZCHF));
            let isZCHFAmountCorrect = ZCHFReceived==25;
            let isPoolShareAmountCorrect = poolTokenSharesRec==-25;
            if(!isZCHFAmountCorrect || !isZCHFAmountCorrect) {
                console.log("ZCHF tokens received = ", ZCHFReceived);
                console.log("Pool shares redeemed = ", -poolTokenSharesRec);
                expect(isPoolShareAmountCorrect).to.be.true;
                expect(isZCHFAmountCorrect).to.be.true;
            }
        });
    });

});
