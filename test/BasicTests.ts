// @ts-nocheck
import {expect} from "chai";
import { floatToDec18, dec18ToFloat } from "../scripts/math";
const { ethers, network } = require("hardhat");
const BN = ethers.BigNumber;
import { createContract } from "../scripts/utils";

let ZCHFContract, positionFactoryContract, equityAddr, equityContract, accounts;
let owner;

describe("Basic Tests", () => {

    function capitalToShares(totalCapital, totalShares, dCapital) {
        if (totalShares==0) {
            return 1000;
        } else {
            return totalShares *( ((totalCapital +dCapital)/totalCapital)**(1/3) - 1 );
        }
    }
    function sharesToCapital(totalCapital, totalShares, dShares) {
        
        return -totalCapital *( ((totalShares - dShares)/totalShares)**(3) - 1 );
    }
    
    function BNToHexNoPrefix(n) {
        let num0x0X = BN.from(n).toHexString();
        return num0x0X.replace("0x0", "0x");
    }

    async function mineNBlocks(n) {
        // hardhat_mine does not accept hex numbers that start with 0x0,
        // hence convert
        await network.provider.send("hardhat_mine", [BNToHexNoPrefix(n)]);
    }

    before(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0].address;
        // create contracts
        // 10 day application period
        ZCHFContract = await createContract("Frankencoin", [10 * 86_400]);
        equityAddr = ZCHFContract.reserve();
        equityContract = await ethers.getContractAt('Equity', equityAddr, accounts[0]);
        positionFactoryContract = await createContract("PositionFactory");
        await createContract("MintingHub", [ZCHFContract.address, positionFactoryContract.address]);
    });

    describe("basic initialization", () => {
        it("symbol should be ZCHF", async () => {
            let symbol = await ZCHFContract.symbol();
            expect(symbol).to.be.equal("ZCHF");
            let name = await ZCHFContract.name();
            expect(name).to.be.equal("Frankencoin");
        });
    });

    describe("mock bridge", () => {
        let mockXCHF;
        let bridge;
        it("create mock token", async () => {
            mockXCHF = await createContract("TestToken", ["CryptoFranc", "XCHF", 18]);
            let symbol = await mockXCHF.symbol();
            expect(symbol).to.be.equal("XCHF");
        });
        it("create mock stable coin bridge", async () => {
            let otherAddr = mockXCHF.address;
            let limit : BigNumber = floatToDec18(100_000);
            bridge = await createContract("StablecoinBridge", [otherAddr, ZCHFContract.address, limit]);
        });
        it("minting fails if not approved", async () => {
            let amount = floatToDec18(10000);
            let tx1 = await mockXCHF.mint(owner, amount);
            let balanceBefore = await ZCHFContract.balanceOf(owner);
            await mockXCHF.connect(accounts[0]).approve(bridge.address, amount);
            // set allowance
            await expect(bridge.connect(accounts[0])["mint(uint256)"](amount)).to.be.revertedWithCustomError(ZCHFContract, "NotMinter");
        });
        it("bootstrap suggestMinter", async () => {
            let applicationPeriod = BN.from(0);
            let applicationFee = BN.from(0);
            let msg = "XCHF Bridge"
            await expect(ZCHFContract.suggestMinter(bridge.address, applicationPeriod, 
                applicationFee, msg)).to.emit(ZCHFContract, "MinterApplied");
            // increase block to be a minter
            await ethers.provider.send('evm_increaseTime', [60]); 
            await network.provider.send("evm_mine") 
            let isMinter = await ZCHFContract.isMinter(bridge.address);
            expect(isMinter).to.be.true;
        });

        it("minter of XCHF-bridge should receive ZCHF", async () => {
            let amount = floatToDec18(5000);
            let balanceBefore = await ZCHFContract.balanceOf(owner);
            // set allowance
            await mockXCHF.connect(accounts[0]).approve(bridge.address, amount);
            await bridge.connect(accounts[0])["mint(uint256)"](amount);
            await mockXCHF.connect(accounts[0]).transferAndCall(bridge.address, amount, 0);
            let balanceXCHFOfBridge = await mockXCHF.balanceOf(bridge.address);
            let balanceAfter = await ZCHFContract.balanceOf(owner);
            let ZCHFReceived = dec18ToFloat(balanceAfter.sub(balanceBefore));
            let isBridgeBalanceCorrect = dec18ToFloat(balanceXCHFOfBridge)==10000;
            let isSenderBalanceCorrect = ZCHFReceived==10000;
            if (!isBridgeBalanceCorrect || !isSenderBalanceCorrect) {
                console.log("Bridge received XCHF tokens ", dec18ToFloat(balanceXCHFOfBridge));
                console.log("Sender received ZCH tokens ", ZCHFReceived);
                expect(isBridgeBalanceCorrect).to.be.true;
                expect(isSenderBalanceCorrect).to.be.true;
            }
            
        });
        it("burner of XCHF-bridge should receive XCHF", async () => {
            let amount = floatToDec18(50);
            let balanceBefore = await ZCHFContract.balanceOf(owner);
            let balanceXCHFBefore = await mockXCHF.balanceOf(owner);
            await ZCHFContract.connect(accounts[0]).approve(bridge.address, amount);
            let allowance1 = await ZCHFContract.allowance(accounts[0].address, bridge.address);
            expect(allowance1).to.be.eq(amount);
            let allowance2 = await ZCHFContract.allowance(accounts[0].address, accounts[1].address);
            expect(allowance2).to.be.eq(floatToDec18(0));
            await ZCHFContract.connect(accounts[0])["burn(uint256)"](amount);
            await bridge.connect(accounts[0])["burn(uint256)"](amount);
            await bridge.connect(accounts[0])["burn(address,uint256)"](accounts[0].address, amount);
            await ZCHFContract.connect(accounts[0])["transferAndCall"](bridge.address, amount, 0);
            let balanceXCHFOfBridge = await mockXCHF.balanceOf(bridge.address);
            let balanceXCHFAfter = await mockXCHF.balanceOf(owner);
            let balanceAfter = await ZCHFContract.balanceOf(owner);
            let ZCHFReceived = dec18ToFloat(balanceAfter.sub(balanceBefore));
            let XCHFReceived = dec18ToFloat(balanceXCHFAfter.sub(balanceXCHFBefore));
            let isBridgeBalanceCorrect = dec18ToFloat(balanceXCHFOfBridge)==9850;
            let isSenderBalanceCorrect = ZCHFReceived==-200;
            let isXCHFBalanceCorrect = XCHFReceived==150;
            if (!isBridgeBalanceCorrect || !isSenderBalanceCorrect || !isXCHFBalanceCorrect) {
                console.log("Bridge balance XCHF tokens ", dec18ToFloat(balanceXCHFOfBridge));
                console.log("Sender burned ZCH tokens ", -ZCHFReceived);
                console.log("Sender received XCHF tokens ", XCHFReceived);
                expect(isBridgeBalanceCorrect).to.be.true;
                expect(isSenderBalanceCorrect).to.be.true;
                expect(isXCHFBalanceCorrect).to.be.true;
            }
        });
    });
    describe("exchanges shares & pricing", () => {
        it("deposit XCHF to reserve pool and receive share tokens", async () => {
            let amount = 1000;// amount we will deposit
            let fAmount = floatToDec18(1000);// amount we will deposit
            let balanceBefore = await equityContract.balanceOf(owner);
            let balanceBeforeZCHF = await ZCHFContract.balanceOf(owner);
            let fTotalShares = await equityContract.totalSupply();
            let fTotalCapital = await ZCHFContract.equity();
            // calculate shares we receive according to pricing function:
            let totalShares = dec18ToFloat(fTotalShares);
            let totalCapital = dec18ToFloat(fTotalCapital);
            let dShares = capitalToShares(totalCapital, totalShares, amount);
            await ZCHFContract.transferAndCall(equityContract.address, fAmount, 0);
            let balanceAfter = await equityContract.balanceOf(owner);
            let balanceAfterZCHF = await ZCHFContract.balanceOf(owner);
            let poolTokenShares = dec18ToFloat(balanceAfter.sub(balanceBefore));
            let ZCHFReceived = dec18ToFloat(balanceAfterZCHF.sub(balanceBeforeZCHF));
            let isPoolShareAmountCorrect = Math.abs(poolTokenShares-dShares) < 1e-7;
            let isSenderBalanceCorrect = ZCHFReceived==-1000;
            if(!isPoolShareAmountCorrect || !isSenderBalanceCorrect) {
                console.log("Pool token shares received = ", poolTokenShares);
                console.log("ZCHF tokens deposited = ", -ZCHFReceived);
                expect(isPoolShareAmountCorrect).to.be.true;
                expect(isSenderBalanceCorrect).to.be.true;
            }

        });
        it("cannot redeem shares immediately", async () => {
            let canRedeem = await equityContract.connect(accounts[0])['canRedeem()']();
            expect(canRedeem).to.be.false;
        });
        it("can redeem shares after *N* blocks", async () => {
            // increase block number so we can redeem
            let BLOCK_MIN_HOLDING_DURATION = 90 * 7200;
            await network.provider.send("hardhat_mine", [BNToHexNoPrefix(BLOCK_MIN_HOLDING_DURATION + 1)]);
            let canRedeem = await equityContract.connect(accounts[0])['canRedeem()']();
            expect(canRedeem).to.be.true;
        });
        it("redeem 1 share", async () => {
            let amountShares = 1;
            let fAmountShares = floatToDec18(amountShares);
            let fTotalShares = await equityContract.totalSupply();
            let fTotalCapital = await ZCHFContract.balanceOf(equityAddr);
            // calculate capital we receive according to pricing function:
            let totalShares = dec18ToFloat(fTotalShares);
            let totalCapital = dec18ToFloat(fTotalCapital);
            let dCapital = sharesToCapital(totalCapital, totalShares, amountShares);

            let sharesBefore = await equityContract.balanceOf(owner);
            let capitalBefore = await ZCHFContract.balanceOf(owner); 
            await equityContract.redeem(owner, fAmountShares);
            let sharesAfter = await equityContract.balanceOf(owner);
            let capitalAfter = await ZCHFContract.balanceOf(owner);
            
            let poolTokenSharesRec = dec18ToFloat(sharesAfter.sub(sharesBefore));
            let ZCHFReceived = dec18ToFloat(capitalAfter.sub(capitalBefore));
            let isZCHFAmountCorrect = Math.abs(ZCHFReceived-dCapital) <= 1e-12;
            let isPoolShareAmountCorrect = poolTokenSharesRec==-amountShares;
            if(!isZCHFAmountCorrect || !isZCHFAmountCorrect) {
                console.log("ZCHF tokens received = ", ZCHFReceived);
                console.log("ZCHF tokens expected = ", dCapital);
                console.log("Pool shares redeemed = ", -poolTokenSharesRec);
                console.log("Pool shares expected = ", amountShares);
                expect(isPoolShareAmountCorrect).to.be.true;
                expect(isZCHFAmountCorrect).to.be.true;
            }
        });
    });

});
