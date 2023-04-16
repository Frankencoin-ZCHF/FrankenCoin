// @ts-nocheck
import {expect} from "chai";
import { floatToDec18, dec18ToFloat } from "../scripts/math";
const { ethers, network } = require("hardhat");
const BN = ethers.BigNumber;
import { createContract } from "../scripts/utils";

let ZCHFContract, mintingHubContract, accounts;
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
        positionFactoryContract = await createContract("PositionFactory");
        mintingHubContract = await createContract("MintingHub", [ZCHFContract.address, positionFactoryContract.address]);
        // mocktoken
        mockXCHF = await createContract("TestToken", ["CryptoFranc", "XCHF", 18]);
        // mocktoken bridge to bootstrap
        let limit = floatToDec18(1000_000);
        bridge = await createContract("StablecoinBridge", [mockXCHF.address, ZCHFContract.address, limit]);
        ZCHFContract.suggestMinter(bridge.address, 0, 0, "XCHF Bridge");
        // create a minting hub too while we have no ZCHF supply
        ZCHFContract.suggestMinter(mintingHubContract.address, 0, 0, "Minting Hub");
        
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
        // owner mints some to be able to create a position
        await mockXCHF.connect(accounts[0]).approve(bridge.address, amount);
        await bridge.connect(accounts[0])["mint(uint256)"](amount);
        // vol tokens
        mockVOL = await createContract("TestToken", ["Volatile Token", "VOL", 18]);
        amount = floatToDec18(500_000);
        await mockVOL.mint(owner, amount);
        
    });

    let positionAddr, positionContract;
    let clonePositionAddr, clonePositionContract;
    let fee = 0.01;
    let reserve = 0.10;
    let mintAmount = 100;
    let initialLimit = floatToDec18(110_000);
    let fMintAmount = floatToDec18(mintAmount);
    let fLimit, limit;
    let fGlblZCHBalanceOfCloner;
    let initialCollateral = 10;//orig position
    let initialCollateralClone = 4;
    let challengeAmount;
    describe("use Minting Hub", () => {
       
        
        it("create position", async () => {
            let collateral = mockVOL.address;
            let fliqPrice = floatToDec18(1000);
            let minCollateral = floatToDec18(1);
            let fInitialCollateral = floatToDec18(initialCollateral);
            let duration = BN.from(14*86_400);
            let fFees = BN.from(fee * 1000_000);
            let fReserve = BN.from(reserve * 1000_000);
            let openingFeeZCHF = await mintingHubContract.OPENING_FEE();
            let challengePeriod = BN.from(7 * 86400); // 7 days
            await mockVOL.connect(accounts[0]).approve(mintingHubContract.address, fInitialCollateral);
            let balBefore = await ZCHFContract.balanceOf(owner);
            let balBeforeVOL = await mockVOL.balanceOf(owner);
            let tx = await mintingHubContract["openPosition(address,uint256,uint256,uint256,uint256,uint256,uint32,uint256,uint32)"]
                (collateral, minCollateral, fInitialCollateral, initialLimit, duration, challengePeriod, fFees, fliqPrice, fReserve);
            let rc = await tx.wait();
            const topic = '0x591ede549d7e337ac63249acd2d7849532b0a686377bbf0b0cca6c8abd9552f2'; // PositionOpened
            const log = rc.logs.find(x => x.topics.indexOf(topic) >= 0);
            positionAddr = log.address;
            let balAfter = await ZCHFContract.balanceOf(owner);
            let balAfterVOL = await mockVOL.balanceOf(owner);
            let dZCHF = dec18ToFloat(balAfter.sub(balBefore));
            let dVOL = dec18ToFloat(balAfterVOL.sub(balBeforeVOL));
            expect(dVOL).to.be.equal(-initialCollateral);
            expect(dZCHF).to.be.equal(-dec18ToFloat(openingFeeZCHF));
            positionContract = await ethers.getContractAt('Position', positionAddr, accounts[0]);
        });
        it("require cooldown", async () => {
            let tx = positionContract.connect(accounts[0]).mint(owner, floatToDec18(5));
            await expect(tx).to.be.revertedWithCustomError(positionContract, "Hot");
        });
        it("get loan after 7 long days", async () => {
            // "wait" 7 days...
            await ethers.provider.send('evm_increaseTime', [7 * 86_400 + 60]); 
            await ethers.provider.send("evm_mine");
            // thanks for waiting so long
            fLimit = await positionContract.limit();
            limit = dec18ToFloat(fLimit);
            let amount = 10_000;
            expect(amount).to.be.lessThan(limit);

            let fAmount = floatToDec18(amount);
            let fZCHFBefore = await ZCHFContract.balanceOf(owner);
            let expectedAmount = dec18ToFloat(await positionContract.getUsableMint(fAmount, true));
            expect(expectedAmount).to.be.eq(8900);
            await positionContract.connect(accounts[0]).mint(owner, fAmount);//).to.emit("PositionOpened");
            let currentFees = await positionContract.calculateCurrentFee();
            expect(currentFees).to.be.eq(10000);
            let fZCHFAfter = await ZCHFContract.balanceOf(owner);
            let ZCHFMinted = dec18ToFloat( fZCHFAfter.sub(fZCHFBefore) );
            expect(expectedAmount).to.be.equal(ZCHFMinted);
        });
        
        it("clone position", async () => {
            let fInitialCollateralClone = floatToDec18(initialCollateralClone);
            let fZCHFAmount = floatToDec18(1000);
            // send some collateral and ZCHF to the cloner
            await mockVOL.transfer(accounts[1].address, fInitialCollateralClone);
            await ZCHFContract.transfer(accounts[1].address, fZCHFAmount);
            
            await mockVOL.connect(accounts[1]).approve(mintingHubContract.address, fInitialCollateralClone);
            fGlblZCHBalanceOfCloner = await ZCHFContract.balanceOf(accounts[1].address);
            let tx = await mintingHubContract.connect(accounts[1]).clonePosition(positionAddr, fInitialCollateralClone, 
                fMintAmount);
            let rc = await tx.wait();
            const topic = '0x591ede549d7e337ac63249acd2d7849532b0a686377bbf0b0cca6c8abd9552f2'; // PositionOpened
            const log = rc.logs.find(x => x.topics.indexOf(topic) >= 0);
            clonePositionAddr = log.address;
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
        it("clone position with too much mint", async () => {
            let fInitialCollateralClone = floatToDec18(initialCollateralClone);
            let fZCHFAmount = floatToDec18(1000);
            // send some collateral and ZCHF to the cloner
            await mockVOL.transfer(accounts[1].address, fInitialCollateralClone);
            await ZCHFContract.transfer(accounts[1].address, fZCHFAmount);
            
            await mockVOL.connect(accounts[1]).approve(mintingHubContract.address, fInitialCollateralClone);
            fGlblZCHBalanceOfCloner = await ZCHFContract.balanceOf(accounts[1].address);
            let tx = mintingHubContract.connect(accounts[1]).clonePosition(positionAddr, fInitialCollateralClone, initialLimit);
            await expect(tx).to.be.reverted; // underflow
        });

        it("repay position", async () => {
            let cloneOwner = await clonePositionContract.connect(accounts[1]).owner();
            expect(cloneOwner).to.be.eq(accounts[1].address);
            let fInitialCollateralClone = floatToDec18(initialCollateralClone);
            let withdrawTx = clonePositionContract.withdrawCollateral(cloneOwner, fInitialCollateralClone);
            await expect(withdrawTx).to.be.revertedWithCustomError(clonePositionContract, "InsufficientCollateral");
            let minted = await clonePositionContract.minted();
            let reservePPM = await clonePositionContract.reserveContribution();
            let repayAmount = minted.sub(minted.mul(reservePPM).div(1000000));
            let reserve = await ZCHFContract.calculateAssignedReserve(minted, reservePPM);
            expect(reserve.add(repayAmount)).to.be.eq(minted);
            await clonePositionContract.repay(repayAmount.sub(reserve));
            let minted1 = await clonePositionContract.minted();
            let reserve1 = await ZCHFContract.calculateAssignedReserve(minted1, reservePPM);
            let repayAmount1 = minted1.sub(reserve1);
            await clonePositionContract.repay(repayAmount1);
            await clonePositionContract.withdrawCollateral(cloneOwner, fInitialCollateralClone);
            let result = await clonePositionContract.isClosed();
            await expect(result).to.be.true;
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
            await expect(tx).to.be.revertedWithCustomError(clonePositionContract, "Challenged");
        });
        it("bid on challenged position", async () => {
            let challengeNumber = 0;
            let liqPrice = dec18ToFloat(await clonePositionContract.price());
            let bidAmountZCHF = liqPrice * 0.95 * challengeAmount; //for the 5 collateral tokens bid
            let fBidAmountZCHF = floatToDec18(bidAmountZCHF);
            
            let tx = await mintingHubContract.connect(accounts[0]).bid(challengeNumber, fBidAmountZCHF, floatToDec18(challengeAmount));
            
            //const receipt = await tx.wait();
            //console.log(JSON.stringify(receipt));
            await expect(tx).to.emit(mintingHubContract, "NewBid").withArgs(challengeNumber, fBidAmountZCHF, owner);
        });
        it("bid on not existing challenge", async () => {
            let tx = mintingHubContract.connect(accounts[2]).bid(42, floatToDec18(42), floatToDec18(challengeAmount));
            await expect(tx).to.be.reverted;
        });
        it("new bid on top of bid", async () => {
            let challengeNumber = 0;
            // accounts[2] sends a bid
            let liqPrice = dec18ToFloat(await clonePositionContract.price());
            let bidAmountZCHF = liqPrice * 0.97 * challengeAmount; //for the 5 collateral tokens bid
            let fBidAmountZCHF = floatToDec18(bidAmountZCHF);
            await ZCHFContract.connect(accounts[0]).transfer(accounts[2].address, fBidAmountZCHF);
            // store balance of old bidder before new bid takes place
            let ownerZCHFbalanceBefore = await ZCHFContract.balanceOf(owner);
            let bidderZCHFbalanceBefore = await ZCHFContract.balanceOf(accounts[2].address);
            // challenge
            let tx = mintingHubContract.connect(accounts[2]).bid(challengeNumber, fBidAmountZCHF, floatToDec18(challengeAmount));
            await expect(tx).to.emit(mintingHubContract, "NewBid").withArgs(challengeNumber, fBidAmountZCHF, accounts[2].address);
            
            // check that previous challenger got back their bid
            let ownerZCHFbalanceAfter = await ZCHFContract.balanceOf(owner);
            let bidAmountZCHFOwner = liqPrice * 0.95 * challengeAmount;
            let cashBack = dec18ToFloat(ownerZCHFbalanceAfter.sub(ownerZCHFbalanceBefore));
            expect(bidAmountZCHFOwner).to.be.equal(cashBack);
        });
        it("cannot end successful challenge early", async () => {
            mintingHubContract.connect(accounts[2]);
            let tx = mintingHubContract["end(uint256)"](0);
            await expect(tx).to.be.revertedWith("period has not ended");
        });
        it("end successful challenge", async () => {
            let challengeNumber = 0;
            await ethers.provider.send('evm_increaseTime', [7*86400+1]); 
            await network.provider.send("evm_mine");
            //challenge successful if 
            //  challenge_amount * liqPrice > bidZCHF
            // our bid = liqPrice * 0.95 * challengeAmount, hence
            //challengeAmount * liqPrice > liqPrice * 0.95 * challengeAmount
            mintingHubContract.connect(accounts[2]);
            await mintingHubContract["end(uint256)"](challengeNumber);
        });
    });

    describe("native position test", () => {

        let mintingHubTest;

        it("initialize", async () => {
            mintingHubTest = await createContract("MintingHubTest", [mintingHubContract.address, bridge.address]);
            await mintingHubTest.initiateEquity();
            await mintingHubTest.initiatePosition();
        });

        it("deny position", async () => {
            await mintingHubTest.initiateAndDenyPosition();
        });

        it("fails when minting too early", async () => {
            let tx = mintingHubTest.letAliceMint();
            await expect(tx).to.be.reverted;
        });

        it("allows minting after 2 days", async () => {
            await ethers.provider.send('evm_increaseTime', [7 * 86_400 + 60]); 
            await ethers.provider.send("evm_mine");
            await mintingHubTest.letAliceMint();
        });

        it("supports withdrawals", async () => {
            await mintingHubTest.testWithdraw();
        });

        it("fails when someone else mints", async () => {
            let tx = mintingHubTest.letBobMint();
            await expect(tx).to.be.reverted;
        });

        it("perform challenge", async () => {
            await mintingHubTest.letBobChallenge();
            let tx = mintingHubTest.endChallenges();
            await expect(tx).to.be.revertedWith('period has not ended');
            await ethers.provider.send('evm_increaseTime', [1 * 86_400 + 60]); 
            await ethers.provider.send("evm_mine");
            await mintingHubTest.endChallenges();
        });

        it("excessive challenge", async () => {
            await mintingHubTest.testExcessiveChallenge();
        });

        it("restructuring", async () => {
            await mintingHubTest.restructure();
        });
        
        it("challenge expired position", async () => {
            await ethers.provider.send('evm_increaseTime', [100 * 86_400]); 
            await ethers.provider.send("evm_mine");
            await mintingHubTest.challengeExpiredPosition();

            await ethers.provider.send('evm_increaseTime', [86_400 - 10]); // 10 seconds before end 
            await ethers.provider.send("evm_mine");
            await mintingHubTest.bidNearEndOfChallenge();
            
            await ethers.provider.send('evm_increaseTime', [20]); 
            await ethers.provider.send("evm_mine");
            let tx = mintingHubTest.endLastChallenge();
            await expect(tx).to.be.revertedWith("period has not ended");

            await ethers.provider.send('evm_increaseTime', [30*60]); 
            await ethers.provider.send("evm_mine");
            await mintingHubTest.endLastChallenge();
        });
    });

});
