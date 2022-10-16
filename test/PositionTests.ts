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
        ZCHFContract = await createContract("Frankencoin", [10 * 86_400]);
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
        ZCHFContract.suggestMinter(mintingHubContract.address, 0, 0, "Minting Hub");
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
    let initialCollateral = 10;//orig position
    let initialCollateralClone = 4;
    let challengeAmount;
    describe("use Minting Hub", () => {
       
        
        it("create position", async () => {
            let collateral = mockVOL.address;
            let initialLimit = floatToDec18(110_000);
            let fliqPrice = floatToDec18(1000);
            let minCollateral = floatToDec18(1);
            let fInitialCollateral = floatToDec18(initialCollateral);
            let duration = BN.from(14*86_400);
            let fFees = BN.from(fee * 1000_000);
            let fReserve = BN.from(reserve * 1000_000);
            let openingFeeZCHF = await mintingHubContract.OPENING_FEE();
            let challengePeriod = BN.from(7 * 86400); // 7 days
            await mockVOL.connect(accounts[0]).approve(mintingHubContract.address, fInitialCollateral);
            await ZCHFContract.connect(accounts[0]).approve(mintingHubContract.address, openingFeeZCHF);
            
            let tx = await mintingHubContract.openPositionMock(collateral, minCollateral, 
                fInitialCollateral, initialLimit, duration, challengePeriod, fFees, fliqPrice, fReserve);
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
            
            let fInitialCollateralClone = floatToDec18(initialCollateralClone);
            let fZCHFAmount = floatToDec18(1000);
            // send some collateral and ZCHF to the cloner
            await mockVOL.transfer(accounts[1].address, fInitialCollateralClone);
            await ZCHFContract.transfer(accounts[1].address, fZCHFAmount);
            
            await mockVOL.connect(accounts[1]).approve(mintingHubContract.address, fInitialCollateralClone);
            await ZCHFContract.connect(accounts[1]).approve(mintingHubContract.address, fZCHFAmount);
            fGlblZCHBalanceOfCloner = await ZCHFContract.balanceOf(accounts[1].address);
            let tx = await mintingHubContract.connect(accounts[1]).clonePositionMock(positionAddr, fInitialCollateralClone, 
                fMintAmount);
            await tx.wait();
            clonePositionAddr = await mintingHubContract.lastPositionAddress();
            clonePositionContract = await ethers.getContractAt('Position', clonePositionAddr, accounts[1]);
            
        });
        it("correct collateral", async () => {
            let col = await mockVOL.balanceOf(clonePositionAddr);
            expect(col).to.be.equal(floatToDec18(initialCollateralClone));
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
            expect(cloneFeeCharged).to.be.equal(0); // no extra fees when cloning
        });
    });
    describe("challenge clone", () => {
        it("send challenge", async () => {
            challengeAmount = initialCollateralClone/2;
            let fchallengeAmount = floatToDec18(challengeAmount);
            await mockVOL.connect(accounts[0]).approve(mintingHubContract.address, fchallengeAmount);
            let tx = await mintingHubContract.connect(accounts[0]).launchChallenge(clonePositionAddr, fchallengeAmount);
            await expect(tx).to.emit(mintingHubContract, "ChallengeStarted");
        });
        it("pos owner cannot withdraw during challenge", async () => {
            let tx = clonePositionContract.withdrawCollateral(clonePositionAddr, floatToDec18(1));
            await expect(tx).to.be.revertedWith("challenges pending");
        });
        it("bid on challenged position", async () => {
            let challengeNumber = 0;
            let liqPrice = dec18ToFloat(await clonePositionContract.price());
            let bidAmountZCHF = liqPrice * 0.95 * challengeAmount; //for the 5 collateral tokens bid
            let fBidAmountZCHF = floatToDec18(bidAmountZCHF);
            
            await ZCHFContract.connect(accounts[0]).approve(mintingHubContract.address, fBidAmountZCHF);
            let tx = await mintingHubContract.connect(accounts[0]).bid(challengeNumber, fBidAmountZCHF);
            
            //const receipt = await tx.wait();
            //console.log(JSON.stringify(receipt));
            await expect(tx).to.emit(mintingHubContract, "NewBid").withArgs(challengeNumber, fBidAmountZCHF, owner);
        });
        it("bid on not existing challenge", async () => {
            let tx = mintingHubContract.connect(accounts[2]).bid(42, floatToDec18(42));
            await expect(tx).to.be.reverted;
        });
        it("new bid on top of bid", async () => {
            let challengeNumber = 0;
            // accounts[2] sends a bid
            let liqPrice = dec18ToFloat(await clonePositionContract.price());
            let bidAmountZCHF = liqPrice * 0.97 * challengeAmount; //for the 5 collateral tokens bid
            let fBidAmountZCHF = floatToDec18(bidAmountZCHF);
            // owner sends some money
            await ZCHFContract.connect(accounts[0]).transfer(accounts[2].address, fBidAmountZCHF);
            // store balance of old bidder before new bid takes place
            let ownerZCHFbalanceBefore = await ZCHFContract.balanceOf(owner);
            // challenge
            await ZCHFContract.connect(accounts[2]).approve(mintingHubContract.address, fBidAmountZCHF);
            let tx = mintingHubContract.connect(accounts[2]).bid(challengeNumber, fBidAmountZCHF);
            await expect(tx).to.emit(mintingHubContract, "NewBid").withArgs(challengeNumber, fBidAmountZCHF, accounts[2].address);
            
            // check that previous challenger got back their bid
            let ownerZCHFbalanceAfter = await ZCHFContract.balanceOf(owner);
            let bidAmountZCHFOwner = liqPrice * 0.95 * challengeAmount;
            let cashBack = dec18ToFloat(ownerZCHFbalanceAfter.sub(ownerZCHFbalanceBefore));
            expect(bidAmountZCHFOwner).to.be.equal(cashBack);
        });
        it("cannot end successful challenge early", async () => {
            let tx = mintingHubContract.connect(accounts[2]).end(0);
            await expect(tx).to.be.revertedWith("period has not ended");
        });
        it("end successful challenge", async () => {
            let challengeNumber = 0;
            await hre.ethers.provider.send('evm_increaseTime', [7*86400+1]); 
            await network.provider.send("evm_mine");
            //challenge successful if 
            //  challenge_amount * liqPrice > bidZCHF
            // our bid = liqPrice * 0.95 * challengeAmount, hence
            //challengeAmount * liqPrice > liqPrice * 0.95 * challengeAmount
            await mintingHubContract.connect(accounts[2]).end(challengeNumber);
        });
    });

});
