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
Your balance: 10'032.23 ZCHF (or: connect you wallet to see your balance) [transfer]
Exchanges: Uniswap, ...

## Reserve Pool

The reserve pool contains Frankencoins. Its purpose is to absorbs losses and accumulates income. Anyone can contribute ZCHF to the reserve pool, getting freely transferrable pool shares in return. Pool shares can be redeemed as long as the reserve target is met. Contributions and redemptions are always done in proportion to the reserve. For example, if the reserve contains 9900 ZCHF and you add 100 ZCHF, you will get 1% of all reserve tokens in return, and vice versa when redeeming Frankencoin Pool Shares (FPS).

Name: Frankencoin Pool Share
Ticker: FPS
Emojis: 🧠 (Brain, U+1F9E0) 
Decimals: 18
Contract address: 0x123123123 (etherscan link)
Total supply: 200'000 FPS
Your balance: 0 FPS (or: connect you wallet to see your balance)
Exchanges: Uniswap, ...
Theoretical Value: 20 ZCHF // divide actual reserve by total supply

Reserve target: 2'133'000 ZCHF
Actual reserve: 4'000'000 ZCHF

[Contribute] [Redeem] // opens according dialogs (?)








