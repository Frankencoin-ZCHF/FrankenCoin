# FrankenCoin

This is the source code repository for the smart contracts of the oracle-free, collateralized stablecoin Frankencoin.

There also is a [public frontend](https://frankencoin.com), a [documentation page](https://docs.frankencoin.com), an outdated [Frankencoin Research Paper](https://www.snb.ch/n/mmr/reference/sem_2022_06_03_maire/source/sem_2022_06_03_maire.n.pdf), and a more recent chapter of a [pending phd thesis](https://frankencoin.com/thesis-preprint-frankencoin.pdf).

## Source Code

The source code can be found in the [contracts](contracts) folder. The following are the most important contracts.

| Contract             | Description                                     |
| -------------------- | ----------------------------------------------- |
| Frankencoin.sol      | The Frankencoin (ZCHF) ERC20 token              |
| Equity.sol           | The Frankencoin Pool Shares (FPS) ERC20 token   |
| MintingHub.sol       | Plugin for oracle-free collateralized minting   |
| Position.sol         | A borrowed minting position holding collateral  |
| PositionRoller.sol   | A module to roll positions into new ones        |
| StablecoinBridge.sol | Plugin for 1:1 swaps with other CHF stablecoins |
| Savings.sol          | A module to pay out interest to ZCHF holders    |

## Compiling and Testing

The project is setup to be compiled and tested with hardhat. Given [node.js](https://heynode.com/tutorial/install-nodejs-locally-nvm/) and hardhat are installed, you can compile or compile and test using these two commands:

```shell
npx hardhat compile
npx hardhat test
npx hardhat coverage
```

## Deployment

Define the private key from your deployer address and etherscan api key as an environment variable in `.env` file.

```shell
PK=0x123456
APIKEY=123456
```

Then run a deployment script with tags and network params (e.g., `sepolia` that specifies the network)

Recommanded commands for `sepolia` network.

```shell
hh deploy --network sepolia --tags MockTokens
hh deploy --network sepolia --tags Frankencoin
hh deploy --network sepolia --tags PositionFactory
hh deploy --network sepolia --tags MintingHub
hh deploy --network sepolia --tags MockCHFToken
hh deploy --network sepolia --tags XCHFBridge
hh deploy --network sepolia --tags positions
```

The networks are configured in `hardhat.config.ts`.

`npx hardhat verify "0x..." --network sepolia`
