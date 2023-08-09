// @ts-nocheck
import { expect } from "chai";
import { floatToDec18, dec18ToFloat } from "../scripts/math";
const { ethers, network } = require("hardhat");
const BN = ethers.BigNumber;
import { createContract } from "../scripts/utils";

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
        await zchf.initialize(bridge.address, "");

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
        it("should have inital price 1 ZCHF / FPS", async () => {
            let price = await equity.price();
            expect(price).to.be.equal(BN.from(10).pow(18));
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
        it("should create 1000 more shares when adding seven capital plus fees", async () => {
            let expected = await equity.calculateShares(floatToDec18(7000 / 0.997));
            expect(expected).to.be.approximately(floatToDec18(1000), floatToDec18(0.01));
            await zchf.transferAndCall(equity.address, floatToDec18(7000 / 0.997), 0);
            let balance = await equity.balanceOf(owner);
            expect(balance).to.be.approximately(floatToDec18(2000), floatToDec18(0.01));
        });
        it("should refuse redemption before time passed", async () => {
            expect(await equity["canRedeem()"]()).to.be.false;
            await expect(equity.redeem(owner, floatToDec18(0.1))).to.be.revertedWithoutReason();
        });
        it("should allow redemption after time passed", async () => {
            await ethers.provider.send('evm_increaseTime', [90 * 86_400 + 60]);
            await ethers.provider.send("evm_mine");
            expect(await equity["canRedeem()"]()).to.be.true;
            let redemptionAmount = (await equity.balanceOf(owner)).sub(floatToDec18(1000.0));
            let equityCapital = dec18ToFloat(await zchf.balanceOf(equity.address));
            let bnred = BN.from(redemptionAmount.toString());
            let proceeds = await equity.calculateProceeds(bnred);
            expect(proceeds).to.be.approximately(floatToDec18(equityCapital / 8 * 7), floatToDec18(equityCapital * 0.003));
            expect(proceeds).to.be.below(floatToDec18(equityCapital / 8 * 7));
        });
    });


    describe("transfer shares", () => {

        it("total votes==sum of owner votes", async () => {
            let other = accounts[5].address;
            let totVotesBefore = await equity.totalVotes();
            let votesBefore = [await equity["votes(address)"](owner), await equity["votes(address)"](other)];
            let isEqual = totVotesBefore - votesBefore[0] == 0;
            if (!isEqual) {
                console.log(`1) total votes before = ${totVotesBefore}`);
                console.log(`1) sum votes before = ${votesBefore}`);
            }
            expect(isEqual).to.be.true;
            let relVotes = await equity.relativeVotes(owner);
            expect(relVotes).to.be.eq(BN.from(10).pow(18));
        });

        it("total votes correct after transfer", async () => {
            let amount = 0.1;
            let other = accounts[5].address;
            let totVotesBefore = await equity.totalVotes();
            let votesBefore = [await equity["votes(address)"](owner), await equity["votes(address)"](other)];
            let balancesBefore = [await equity.balanceOf(owner), await equity.balanceOf(other)];
            await equity.transfer(other, floatToDec18(amount));
            let balancesAfter = [await equity.balanceOf(owner), await equity.balanceOf(other)];
            expect(balancesAfter[1] > balancesBefore[1]).to.be.true;
            let totVotesAfter = await equity.totalVotes();
            let votesAfter = [await equity["votes(address)"](owner), await equity["votes(address)"](other)];
            let isEqual1 = totVotesBefore - votesBefore[0] == 0;
            let isEqual2 = totVotesAfter - votesAfter[0] - votesAfter[1] == 0;
            if (!isEqual1 || !isEqual2) {
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
            let isZero = votesAfter[1] == 0
            if (!isEqual || isZero) {
                console.log(`3) total votes after = ${totVotesAfter}`);
                console.log(`3) votes after = ${votesAfter}`);
            }
            expect(isEqual && !isZero).to.be.true;
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

        it("kamikaze", async () => {
            let tx = equity.connect(accounts[2]).kamikaze(accounts[5].address, BN.from(1000000));
            await expect(tx).to.be.reverted; // account 2 has no votes

            await ethers.provider.send('evm_increaseTime', [80]);
            await ethers.provider.send("evm_mine");
            let balance0 = await equity.balanceOf(accounts[0].address);
            let balance5 = await equity.balanceOf(accounts[5].address);
            let totalSupply = await equity.totalSupply();
            expect(balance0.add(balance5)).to.be.eq(totalSupply);
            let votesBefore0 = await equity["votes(address)"](accounts[0].address);
            let votesBefore5 = await equity["votes(address)"](accounts[5].address);
            let totalVotesBefore = await equity.totalVotes();
            await equity.connect(accounts[0]).kamikaze(accounts[5].address, votesBefore5);
            let votesAfter0 = await equity["votes(address)"](accounts[0].address);
            let votesAfter5 = await equity["votes(address)"](accounts[5].address);
            let adjustement0 = balance0.mul(BN.from(2).pow(20));
            let adjustement5 = balance5.mul(BN.from(2).pow(20));
            let expectedTotalVotes = totalVotesBefore.add(totalSupply.mul(BN.from(2).pow(20)));
            let loss0 = votesBefore0.sub(votesAfter0.sub(adjustement0));
            let loss5 = votesBefore5.sub(votesAfter5.sub(adjustement5));
            expect(loss5).to.be.eq(votesBefore5);
            expect(loss0).to.be.approximately(votesBefore5, BN.from(2000).mul(BN.from(10).pow(18)));
            let totalVotesA = await equity.totalVotes();
            expect(expectedTotalVotes.sub(totalVotesA)).to.be.eq(loss0.add(loss5));
        });
    });
});
