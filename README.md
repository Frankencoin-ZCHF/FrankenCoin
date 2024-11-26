# dEURO

This repository is a friendly fork of Frankencoin-ZCHF.

This is the source code repository for the smart contracts of the oracle-free, collateralized stablecoin dEURO.

There also is a [public frontend](https://app.dEURO.com) and a [documentation page](https://docs.dEURO.com).

## Source Code

The source code can be found in the [contracts](contracts) folder. The following are the most important contracts.

| Contract              | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| DecentralizedEURO.sol | The DecentralizedEURO (dEURO) ERC20 token                        |
| Equity.sol            | The Native Decentralized Euro Protocol Share (nDEPS) ERC20 token |
| MintingHub.sol        | Plugin for oracle-free collateralized minting                    |
| Position.sol          | A borrowed minting position holding collateral                   |
| StablecoinBridge.sol  | Plugin for 1:1 swaps with other EUR stablecoins                  |

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

# Deployment

Define the private key from your deployer address and etherscan api key as an environment variable in `.env` file.

```shell
PK=0x123456
APIKEY=123456
```

### Deploy Contract (manual)

Then run a deployment script with tags and network params (e.g., `sepolia` that specifies the network)

Recommanded commands for `sepolia` network.

```shell
hh deploy --network sepolia --tags MockTokens
hh deploy --network sepolia --tags DecentralizedEURO
hh deploy --network sepolia --tags PositionFactory
hh deploy --network sepolia --tags MintingHub
hh deploy --network sepolia --tags MockEURToken
hh deploy --network sepolia --tags XEURBridge
hh deploy --network sepolia --tags positions
```

The networks are configured in `hardhat.config.ts`.

### Deploy Contract (via hardhat ignition)

```bash
npx hardhat ignition deploy ./ignition/modules/$MODULE.ts --network polygon --deployment-id $ID
```

> Check out ./ignition/deployments/[deployment]/deployed_addresses.json

> Check out ./ignition/deployments/[deployment]/journal.jsonl

### Verity Deployed Contract

```bash
npx hardhat verify --network polygon --constructor-args ./ignition/constructor-args/$FILE.js $ADDRESS
```

# NPM and packages

### Publish for NPM Pkg

- `yarn run compile`
- deploy smart contracts
- save address and constructor args
- prepare /export with addresses, abis, ...
- increase package version
- `yarn run build` (tsup)
- log into npm via the console
- `npm publish --access public`

NPM Package: [@deuro/eurocoin](https://www.npmjs.com/package/@deuro/eurocoin)

Publish: You need to be logged in and execute `npm publish --access public`

Edit: `/exports/index.ts` for all pkg exports.

### @dev: how to transpile package into bundled apps

E.g. for `NextJs` using the `next.config.js` in root of project.

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@.../core", "@.../api"],
};

module.exports = nextConfig;
```
