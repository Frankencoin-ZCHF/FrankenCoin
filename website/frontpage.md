[Connect Button]

# Frankencoin

## Introduction

This website provides a frontend to the Frankencoin smart contracts that reside on Ethereum mainnet. Both the website and the smart contracts governing the Frankencoin are open source and can be freely copied for any purpose.

The Frankencoin is a collateralized stablecoin that is intended to track the value of the Swiss Franc. It's governance is decentralized, with anyone being able to propose new minting mechanisms and anyone who contributed more than 3% to the stability reserve being able to veto new minting mechanisms. It should be seen as experimental and not be relied upon. The core ideas of the Frankencoin including a novel auction-based minting mechanism are described in the [Frankencoin research paper](https://www.snb.ch/n/mmr/reference/sem_2022_06_03_maire/source/sem_2022_06_03_maire.n.pdf). Unlike the minting mechanisms of other collateralized stablecoins, Frankencoin's auction-based mechanism does not depend on external oracles and is therefore also very versatile with regards to the used collateral, as long as its volatility with regards to the Swiss Franc is limited.

The structure of the website follows the technical structure of the smart contracts.

## Frankencoin Contract

Frankencoin is a freely transferrable token that follows the ERC-20 standard. The name is inspired by its self-governing nature.

Name: Frankencoin
Ticker: ZCHF
Emojis: 🧟 (Zombie, U+1F9DF), 🌕 (Moon, U+1F315), 🧀 (Cheese, U+1F9C0)
Decimals: 18
Contract address: 0x123123123 (etherscan link)
Total supply: 10'000'000 ZCHF
Your balance: 10'032.23 ZCHF (or: connect you wallet to see your balance)
Exchanges: Uniswap, ...

## Reserve Pool

The reserve pool contains Frankencoins. Its purpose is to absorbs losses and accumulates income. Anyone can contribute ZCHF to the reserve pool, getting freely transferrable pool shares in return. Pool shares can be redeemed as long as the reserve target is met. Contributions and redemptions are always done in proportion to the reserve. For example, if the reserve contains 9900 ZCHF and you add 100 ZCHF, you will get 1% of all reserve tokens in return, and vice versa when redeeming Frankencoin Pool Shares (FPS).

Name: Frankencoin Pool Share
Ticker: FPS
Emojis: 🧠 (Brain, U+1F9E0) 
Decimals: 18
Contract address: 0x123123123 (etherscan link)
Total supply: 200'000 FPS
Exchanges: Uniswap, ...
Theoretical Value: 20 ZCHF // divide actual reserve by total supply

Reserve target: 2'133'000 ZCHF
Actual reserve: 4'000'000 ZCHF

Your balance: 0 FPS (or: connect you wallet to see your balance)
Contribue:     [                 ] [max] [Contribute]  // Contribute method: ZCHF.transferAndCall(reserve, zchfAmount, null);
Redeem:        [                 ] [max] [Redeem]      // Redeem method: reserve.redeem(fpsAmount);

Veto threshold: 3.0%
Your voting power: 1.7%                             
Thereof from others delegating to you: 1.2%
Delegate to:  [                                    ] [delegate]

## Stablecoin Brides

Bridge contracts allow you to convert other Swiss Franc stablecoins 1:1 into ZCHF. The deposited stablecoins are kept in the bridge contract until another user wants to convert ZCHF back into the resprective stablecoin.

TODO: how do we find out what bridges there are? Start with three hard-coded bridges:
[contract, message] for each of them

### CryptoFranc (XCHF)

description

Name: CryptoFranc // obtained with bridge.chf().name()
Ticker: XCHF // obtained with bridge.chf().symbol()
Contract: 0x123123123 // bridge.chf(), link to Etherscan
Bridge balance: // obtained with bridge.chf().balanceOf(bridge)
Bridge limit: 1'000'000 XCHF // bridge.limit()
Bridge expiration: 2023-08-01 // bridge.horizon()

Your balance: 12'312 XCHF

Create ZCHF with XCHF: [             100] [max] ZCHF [ Mint ]     // check approval, then bridge.mint(amount)
Redeem XCHF from ZCHF: [            5000] [max] XCHF [ Redeem ]   // bridge.burn(amount);

### Jarvis Franc (jCHF)

Same as above

### Digital Franc (DCHF)

Same as above

## Collateralized Positions

Collateralized minting positions allow their owner to mint ZCHF against a collateral. Anyone can open new collateral positions and start minting ZCHF once the initialization period has passed. Positions that are not sufficiently collateralized can be challenged by anyone through an auction mechanism. When challenging a position, the challenger must provide some of the collateral. If the highest bid in the subsequent auction is high enough to show that the position is sufficiently collateralized, the challenge is averted and the bidder gets the challengers collateral in exchange for the highest bid. If the highest bid is lower, the challenge is considered successful, the bidder gets the collateral from the position and the position is closed, distributing excess proceeds to the reserve and paying a reward to the challenger.

### Your Positions

Login to see your collateralized positions.

### Newly Proposed Positions

Position Table

Address | Owner | Collateral             | Status                        | Message                          |  Action
0x123   | 0x234 | Liquity Dollars (LUSD) | Online in 43:23:12            | Allow minting ZCHF with LUSD     |  [ Veto ]

### Established Positions











