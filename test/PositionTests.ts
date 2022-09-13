// @ts-nocheck
import {expect} from "chai";
import { floatToDec18, dec18ToFloat } from "../scripts/math";
const { ethers, bytes } = require("hardhat");
const BN = ethers.BigNumber;
import { createContract } from "../scripts/utils";

let ZCHFContract, equityContract, equityAddr, mintingHubContract, accounts;
let positionFactoryContract;
let mockXCHF, mockVOL, bridge;
let owner, sygnum;

describe("Position Tests", () => {

    before(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0].address;
        sygnum = accounts[1].address;
        // create contracts
        ZCHFContract = await createContract("Frankencoin");
        equityAddr = ZCHFContract.reserve();
        equityContract = await ethers.getContractAt('Equity', equityAddr, accounts[0]);
        positionFactoryContract = await createContract("PositionFactory");
        mintingHubContract = await createContract("MockMintingHub", [ZCHFContract.address, positionFactoryContract.address]);
        // mocktoken
        mockXCHF = await createContract("MockXCHFToken");
        // mocktoken bridge to bootstrap
        let limit = floatToDec18(100_000);
        bridge = await createContract("StablecoinBridge", [mockXCHF.address, ZCHFContract.address, limit]);
        ZCHFContract.suggestMinter(bridge.address, 0, 0, "XCHF Bridge");
        // create a minting hub too while we have no ZCHF supply
        ZCHFContract.suggestMinter(mintingHubContract.address, 0, 0, "XCHF Bridge");
        ZCHFContract.setPositionFactory(positionFactoryContract.address);
        
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

    let positionAddr, positionContract;
    let clonePositionAddr, clonePositionContract;
    let fee = 0.01;
    let reserve = 0.10;
    let mintAmount = 100;
    let fMintAmount = floatToDec18(mintAmount);
    let fLimit, limit;
    let fGlblZCHBalanceOfCloner;

    describe("use Minting Hub", () => {
       
        
        it("create position", async () => {
            let collateral = mockVOL.address;
            let initialLimit = floatToDec18(110_000);
            let liqPrice = floatToDec18(1400);
            let minCollateral = floatToDec18(1);
            let initialCollateral = floatToDec18(110_000);
            let duration = BN.from(14*86_400);
            let fFees = BN.from(fee * 1000_000);
            let fReserve = BN.from(reserve * 1000_000);
            let openingFeeZCHF = await mintingHubContract.OPENING_FEE();
            await mockVOL.connect(accounts[0]).approve(mintingHubContract.address, initialCollateral);
            await ZCHFContract.connect(accounts[0]).approve(mintingHubContract.address, openingFeeZCHF);
            
            let tx = await mintingHubContract.openPositionMock(collateral, minCollateral, 
                initialCollateral, initialLimit, duration, fFees, liqPrice, fReserve);
            await tx.wait();
            // mock contract stores the last position address
            positionAddr = await mintingHubContract.lastPositionAddress();
            //console.log("positionAddr =", positionAddr);
            positionContract = await ethers.getContractAt('Position', positionAddr, accounts[0]);
        });
        it("require cooldown", async () => {
            let tx = positionContract.connect(accounts[0]).mint(owner, floatToDec18(5));
            await expect(tx).to.be.revertedWith("cooldown");
        });
        it("get loan after 7 long days", async () => {
            // "wait" 7 days...
            await hre.ethers.provider.send('evm_increaseTime', [7 * 86_400 + 60]); 
            await hre.ethers.provider.send("evm_mine");
            // thanks for waiting so long
            fLimit = await positionContract.limit();
            limit = dec18ToFloat(fLimit);
            let amount = 10_000;
            expect(amount).to.be.lessThan(limit);

            
            let fAmount = floatToDec18(amount);
            let fZCHFBefore = await ZCHFContract.balanceOf(owner);
            await positionContract.connect(accounts[0]).mint(owner, fAmount);//).to.emit("PositionOpened");
                        
            let fZCHFAfter = await ZCHFContract.balanceOf(owner);
            let ZCHFMinted = dec18ToFloat( fZCHFAfter.sub(fZCHFBefore) );
            let amountExpected = amount * (1 - fee - reserve);
            if (amountExpected != ZCHFMinted) {
                console.log("Amount expected = ", amountExpected);
                console.log("Amount received = ", ZCHFMinted);
            }
            expect(amountExpected).to.be.equal(ZCHFMinted);

        });
        
        it("clone position", async () => {
            
            let fInitialCollateral = floatToDec18(10_000);
            
            // send some collateral and ZCHF to the cloner
            await mockVOL.transfer(accounts[1].address, fInitialCollateral);
            await ZCHFContract.transfer(accounts[1].address, fInitialCollateral);
            
            await mockVOL.connect(accounts[1]).approve(mintingHubContract.address, fInitialCollateral);
            await ZCHFContract.connect(accounts[1]).approve(mintingHubContract.address, fInitialCollateral);
            fGlblZCHBalanceOfCloner = await ZCHFContract.balanceOf(accounts[1].address);
            let tx = await mintingHubContract.connect(accounts[1]).clonePositionMock(positionAddr, fInitialCollateral, 
                fMintAmount);
            await tx.wait();
            clonePositionAddr = await mintingHubContract.lastPositionAddress();
            clonePositionContract = await ethers.getContractAt('Position', clonePositionAddr, accounts[1]);
            
        });
        it("global mint limit retained", async () => {
            let fLimit0 = await clonePositionContract.limit();
            let fLimit1 = await positionContract.limit();
            let glblLimit = dec18ToFloat(fLimit0.add(fLimit1));
            if (glblLimit != limit) {
                console.log("new global limit =", glblLimit);
                console.log("original global limit =", limit);
            }
            expect(glblLimit).to.be.equal(limit);
            
        });
        it("correct fees charged", async () => {
            // fees:
            // - reserve contribution (temporary fee)
            // - mintingFeePPM 
            // - position fee (or clone fee)
            let reserveContributionPPM = await clonePositionContract.reserveContribution();
            let mintingFeePPM = await clonePositionContract.mintingFeePPM();
            
            let fBalanceAfter = await ZCHFContract.balanceOf(accounts[1].address);
            let mintAfterFees = mintAmount *( 1 - mintingFeePPM/1000_000 - reserveContributionPPM/1000_000)
            let cloneFeeCharged = dec18ToFloat(fGlblZCHBalanceOfCloner.sub(fBalanceAfter))+mintAfterFees;
            let fCloneFee = await mintingHubContract.OPENING_FEE();
            let cloneFee = dec18ToFloat(fCloneFee);
            if (cloneFee!=cloneFeeCharged) {
                console.log("Charged=", cloneFeeCharged);
                console.log("Fee expected=", cloneFee);
            }
            expect(cloneFeeCharged).to.be.equal(cloneFee);
        });
    });
    describe("challenge clone", () => {
        it("send challenge", async () => {
            let challengeAmount = 5000;
            let fchallengeAmount = floatToDec18(challengeAmount);
            await mockVOL.connect(accounts[0]).approve(mintingHubContract.address, fchallengeAmount);
            let tx = mintingHubContract.connect(accounts[0]).launchChallenge(clonePositionAddr, fchallengeAmount);
            await expect(tx).to.emit(mintingHubContract, "ChallengeStarted")
                .withArgs(owner, clonePositionAddr, fchallengeAmount, 0);
        });
        it("pos owner cannot withdraw during challenge", async () => {
            let tx = clonePositionContract.withdrawCollateral(clonePositionAddr, floatToDec18(1));
            await expect(tx).to.be.revertedWith("challenges pending");
        });

    });

});
