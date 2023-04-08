// @ts-nocheck
import {expect} from "chai";
import { float } from "hardhat/internal/core/params/argumentTypes";
import { floatToDec18, dec18ToFloat } from "../scripts/math";
const { ethers, network } = require("hardhat");
const BN = ethers.BigNumber;
import { createContract } from "../scripts/utils";
import { Equity__factory } from "../typechain";

let zchf, bridge, xchf, equity;
let accounts, owner;

describe("Equity Tests", () => {
    
    before(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0].address;
        // create contracts
        xchf = await createContract("TestToken", ["CryptoFranc", "XCHF", 18]);
        zchf = await createContract("Frankencoin", [10 * 86_400]);
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
        it("should have the right name", async () => {
            let symbol = await equity.name();
            expect(symbol).to.be.equal("Frankencoin Pool Share");
        });
        it("should have some coins", async () => {
            let balance = await zchf.balanceOf(owner);
            expect(balance).to.be.equal(floatToDec18(1000_000));
        });
    });

    function BNToHexNoPrefix(n) {
        let num0x0X = BN.from(n).toHexString();
        return num0x0X.replace("0x0", "0x");
    }

    describe("minting shares", () => {
        it("should create an initial share", async () => {
            await zchf.transferAndCall(equity.address, floatToDec18(1000), 0);
            let balance = await equity.balanceOf(owner);
            expect(balance).to.be.equal(floatToDec18(1000));
        });
        it("should create 1000 more shares when adding seven capital", async () => {
            let expected = await equity.calculateShares(floatToDec18(7000));
            expect(expected).to.be.approximately(floatToDec18(1000), floatToDec18(0.01));
            await zchf.transferAndCall(equity.address, floatToDec18(7000), 0);
            let balance = await equity.balanceOf(owner);
            expect(balance).to.be.approximately(floatToDec18(2000), floatToDec18(0.01));
        });
        it("should refuse redemption before time passed", async () => {
            expect(await equity["canRedeem()"]()).to.be.false;
            await expect(equity.redeem(owner, floatToDec18(0.1))).to.be.revertedWithoutReason();
        });
        it("should allow redemption after time passed", async () => {
            let BLOCK_MIN_HOLDING_DURATION = 90 * 7200;
            await network.provider.send("hardhat_mine", [BNToHexNoPrefix(BLOCK_MIN_HOLDING_DURATION + 1)]);
            expect(await equity["canRedeem()"]()).to.be.true;
            let redemptionAmount = (await equity.balanceOf(owner)).sub(floatToDec18(1000.0));
            let bnred = BN.from(redemptionAmount.toString());
            let proceeds = await equity.calculateProceeds(bnred);
            expect(proceeds).to.be.approximately(floatToDec18(7000.0), floatToDec18(0.01));
        });
    });


    describe("transfer shares", () => {
        
        it("total votes==sum of owner votes", async () => {
            let other = accounts[5].address;
            let totVotesBefore = await equity.totalVotes();
            let votesBefore = [await equity["votes(address)"](owner), await equity["votes(address)"](other)];
            let isEqual = totVotesBefore-votesBefore[0]==0;
            if(!isEqual) {
                console.log(`1) total votes before = ${totVotesBefore}`);
                console.log(`1) sum votes before = ${votesBefore}`);
            }
            expect(isEqual).to.be.true;
        });

        it("total votes correct after transfer", async () => {
            let amount = 0.1;
            let other = accounts[5].address;
            let totVotesBefore = await equity.totalVotes();
            let votesBefore = [await equity["votes(address)"](owner), await equity["votes(address)"](other)];
            let balancesBefore = [await equity.balanceOf(owner), await equity.balanceOf(other)];
            await equity.transfer(other, floatToDec18(amount));
            let balancesAfter = [await equity.balanceOf(owner), await equity.balanceOf(other)];
            expect(balancesAfter[1]>balancesBefore[1]).to.be.true;
            let totVotesAfter = await equity.totalVotes();
            let votesAfter = [await equity["votes(address)"](owner), await equity["votes(address)"](other)];
            let isEqual1 = totVotesBefore-votesBefore[0] ==0;
            let isEqual2 = totVotesAfter-votesAfter[0]-votesAfter[1]==0;
            if(!isEqual1 || !isEqual2) {
                console.log(`2) total votes before = ${totVotesBefore}`);
                console.log(`2) votes before = ${votesBefore}`);
                console.log(`2) total votes after = ${totVotesAfter}`);
                console.log(`2) votes after = ${votesAfter}`);
            }
            expect(isEqual1 && isEqual2).to.be.true;
        });

        it("total votes correct after mine", async () => {
            await ethers.provider.send('evm_mine');
            await ethers.provider.send('evm_mine');
            let other = accounts[5].address;
            let totVotesAfter = await equity.totalVotes();
            let votesAfter = [await equity["votes(address)"](owner), await equity["votes(address)"](other)];
            let isEqual = (totVotesAfter.sub(votesAfter[0]).sub(votesAfter[1])) == 0;
            let isZero = votesAfter[1]==0
            if(!isEqual || isZero) {
                console.log(`3) total votes after = ${totVotesAfter}`);
                console.log(`3) votes after = ${votesAfter}`);
            }
            expect(isEqual&&!isZero).to.be.true;
        }); 

        it("delegate vote", async () => {
            await equity.connect(accounts[5]).delegateVoteTo(accounts[2].address);
            await equity.connect(accounts[2]).delegateVoteTo(accounts[0].address);
            let qualified1 = await equity["votes(address,address[])"](accounts[0].address, [accounts[2].address, accounts[5].address]);
            let qualified2 = await equity["votes(address,address[])"](accounts[0].address, []);
            expect(qualified1 > qualified2).to.be.true;
            let tx = equity["votes(address,address[])"](accounts[5].address, [accounts[2].address]);
            expect(tx).to.be.reverted;
        }); 
    });
});
