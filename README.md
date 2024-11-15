# EURO Coin

This repository is a friendly fork of Frankencoin-ZCHF.

This is the source code repository for the smart contracts of the oracle-free, collateralized stablecoin Frankencoin.

There also is a [public frontend](https://app.euro-coin.io) and a [documentation page](https://docs.euro-coin.io).

## Source Code

The source code can be found in the [contracts](contracts) folder. The following are the most important contracts.

| Contract             | Description                                     |
| -------------------- | ----------------------------------------------- |
| EuroCoin.sol         | The Euro Coin (ZEUR) ERC20 token                |
| Equity.sol           | The Euro Coin Pool Shares (EPS) ERC20 token     |
| MintingHub.sol       | Plugin for oracle-free collateralized minting   |
| Position.sol         | A borrowed minting position holding collateral  |
| StablecoinBridge.sol | Plugin for 1:1 swaps with other EUR stablecoins |

## Compiling and Testing

The project is setup to be compiled and tested with hardhat. Assuming [node.js](https://heynode.com/tutorial/install-nodejs-locally-nvm/) is already present, try commands like these to get ready:

```shell
npm install --global hardhat-shorthand
yarn
```

Once all is there, you can compile or compile & test using these two commands:

```shell
hh compile
hh test
hh coverage
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
