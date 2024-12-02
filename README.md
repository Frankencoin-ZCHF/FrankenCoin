# dEURO

This repository is a friendly fork of Frankencoin-ZCHF.

This is the source code repository for the smart contracts of the oracle-free, collateralized stablecoin dEURO.

There also is a [public frontend](https://app.dEURO.com) and a [documentation page](https://docs.dEURO.com).

### Source Code

The source code can be found in the [contracts](contracts) folder. The following are the most important contracts.

| Contract              | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| DecentralizedEURO.sol | The DecentralizedEURO (dEURO) ERC20 token                        |
| Equity.sol            | The Native Decentralized Euro Protocol Share (nDEPS) ERC20 token |
| MintingHub.sol        | Plugin for oracle-free collateralized minting                    |
| Position.sol          | A borrowed minting position holding collateral                   |
| PositionRoller.sol   | A module to roll positions into new ones        |
| StablecoinBridge.sol  | Plugin for 1:1 swaps with other EUR stablecoins                  |
| Savings.sol          | A module to pay out interest to ZCHF holders    |

# Code basis and changes after the fork

The last status adopted by Frankencoin was Commit [a2ce625c554bbd3465a31e7d8b7360a054339dd2]([https://app.dEURO.com](https://github.com/Frankencoin-ZCHF/FrankenCoin/commit/a2ce625c554bbd3465a31e7d8b7360a054339dd2) on December 2, 2024. The following things were built on it as a fork.

## Core module
ZCHF was renamed to dEURO
Frankencoin was renamed to DecentralizedEURO
FPS was renamed to nDEPS (native Decentralized Protocol Share)
nDEPS now cost 1000 times less than the FPS for Frankencoin
ERC20 token has been completely converted to standard Open Zeppelin V5
ERC165 token standard has been added
ERC3009 added
SmartContract internal exchange fee (can also be called issuance fee) increased from 0.3% to 2%. 

## WFPS Wrapper
WFPS has been renamed to nDEPS
WFPS has been renamed DEPS
(so “w” is no longer used for “wrapped” but the non-wrapped version is now called “native”)

## Bridges
Frankencoin had a single bridge to XCHF from Bitcoin Suisse
dEURO has 4 bridges to 
	Tether EUR
	Circle EUR
	VNX EUR
	Stasis EUR

## Minting module v1
In contrast to Frankencoin, dEURO does not use the minting module v1 at all

# Audit Reports
2023-02-10 [Blockbite](https://github.com/Frankencoin-ZCHF/FrankenCoin/blob/main/audits/blockbite-audit.pdf)
2023-06-09 [code4rena](https://code4rena.com/reports/2023-04-frankencoin)
2023-10-30 [chainsecurity Report 1](https://github.com/Frankencoin-ZCHF/FrankenCoin/blob/main/audits/V1/blockbite-audit.pdf)
2024-09-25 [Decurity](https://github.com/Decurity/audits/blob/master/Frankencoin/frankencoin-audit-report-2024-1.1.pdf)
2024-11-28 [ChainSecurity Report 2](https://cdn.prod.website-files.com/65d35b01a4034b72499019e8/674873bff5163fea0b1d9faa_ChainSecurity_Frankencoin_Frankencoin_v2024_audit.pdf)

# Development

### Yarn Package Scripts

```json
// yarn run <command> args...

"wallet": "npx ts-node helper/wallet.info.ts",

"compile": "npx hardhat compile",
"test": "npx hardhat test",
"coverage": "npx hardhat coverage",

"deploy": "npx hardhat ignition deploy",
"verify": "npx hardhat verify",

"build": "tsup",
"publish": "npm publish --access public"
```

### 1. Install dependencies

`yarn install`

### 2. Set Environment

> See .env.example

```JSON
file: .env

ALCHEMY_RPC_KEY=...
DEPLOYER_SEED="test test test test test test test test test test test junk"
DEPLOYER_SEED_INDEX=1 // optional, select deployer
ETHERSCAN_API=...
```

> Create new session or re-navigate to the current directory, to make sure environment is loaded from `.env`

### 3. Develop Smart Contracts

> Develop your contracts in the `/contracts` directory and compile with:

```Bash
yarn run compile					# Compiles all contracts
```

### 4. Testing

> All test files are located in /test directory. Run tests using:

```Bash
yarn run test                    	# Run all tests
yarn run test test/TESTSCRIPT.ts 	# Run specific test file
yarn run coverage               	# Generate test coverage report
```

With tsc-watch (auto refresh commands)

```shell
npx tsc-watch --onCompilationComplete "npx hardhat test ./test/RollerTests.ts"
```

### 5.0 Deploy Contract (manual)

Then run a deployment script with tags and network params (e.g., `sepolia` that specifies the network)

```shell
hh deploy --network sepolia --tags MockTokens
hh deploy --network sepolia --tags DecentralizedEURO
hh deploy --network sepolia --tags PositionFactory
hh deploy --network sepolia --tags MintingHub
hh deploy --network sepolia --tags MockEURToken
hh deploy --network sepolia --tags XEURBridge
hh deploy --network sepolia --tags positions
```

> Recommanded commands for `sepolia` network.
> The networks are configured in `hardhat.config.ts`.

### 5. Write Deployment Scripts (via ignition deploy and verify)

> Deployment modules are located in /ignition/modules. Deploy your contracts:

```Bash
yarn run deploy ignition/modules/MODULE --network polygon --verify --deployment-id MODULE_ID_01

--> increase: deployment-id
```

This will:

- Compile and deploy contracts
- Verify on Etherscan and Sourcify
- Generate deployment artifacts in /ignition/deployments

Verify:

- verifies contract on etherscan
- verifies contract on sourcify

Key deployment files:

- deployed_addresses.json: Contains contract addresses
- journal.json: Detailed deployment logs

- creates deployment artifacts in /ignition`/deployments` directory
- creates ./ignition/deployments/[deployment]/`deployed_addresses.json`
- creates ./ignition/deployments/[deployment]/`journal.jsonl`
- creates constructor-args in /ignition`/constructor-args` directory, as JS module export

### 5.1 Example

```Bash
✔ Confirm deploy to network polygon (137)? … yes
{
  message: 'Config Info: Deploying Module with accounts',
  admin: '0xb687FE7E47774B22F10Ca5E747496d81827167E3',
  executor: '0xBdae8D35EDe5bc5174E805DcBe3F7714d142DAAb',
  member: '0x2ACf17C04F1d8BE7E9D5529894DCee86bf2fcdC3'
}
Constructor Args
[
  '0xb687FE7E47774B22F10Ca5E747496d81827167E3',
  '0xBdae8D35EDe5bc5174E805DcBe3F7714d142DAAb',
  '0x2ACf17C04F1d8BE7E9D5529894DCee86bf2fcdC3'
]
Hardhat Ignition 🚀

Deploying [ MembershipModule ]

Batch #1
  Executed MembershipModule#Membership

Batch #2
  Executed MembershipModule#Storage

[ MembershipModule ] successfully deployed 🚀

Deployed Addresses

MembershipModule#Membership - 0x72950A0A9689fCA941Ddc9E1a58dcD3fb792E3D2
MembershipModule#Storage - 0x8A7e8091e71cCB7D1EbDd773C26AD82AAd323328

Verifying deployed contracts

Verifying contract "contracts/Membership.sol:Membership" for network polygon...
Contract contracts/Membership.sol:Membership already verified on network polygon:
  - https://polygonscan.com/address/0x72950A0A9689fCA941Ddc9E1a58dcD3fb792E3D2#code

Verifying contract "contracts/Storage.sol:Storage" for network polygon...
Contract contracts/Storage.sol:Storage already verified on network polygon:
  - https://polygonscan.com/address/0x8A7e8091e71cCB7D1EbDd773C26AD82AAd323328#code

✨  Done in 69.96s.
```

### 5.2 Manual Verify

`npx hardhat verify --network polygon --constructor-args ./ignition/constructor-args/$FILE.js $ADDRESS`

or manually include unrelated contracts

`npx hardhat ignition verify $DEPLOYMENT --include-unrelated-contracts`

### 6 Prepare NPM Package Support

- [x] Export ready to use TypeScript ABIs
- [x] Export ready to use TypeScript deployed address config
- [ ] ...

### 6.1 TypeScript ABIs

Export contract ABIs for npm package usage by copying the JSON into dedicated TypeScript files:

```TS
file: exports/abis/...

export const StorageABI = [
...
JSON
...
] as const;
```

### 6.2 TypeScript Address Config

Provides a mapping of contract addresses for the Membership and Storage contracts deployed on different blockchain networks.

The `ADDRESS` object contains the contract addresses for the `mainnet` and `polygon` networks, with the network ID as the key.
The `zeroAddress` is used as a placeholder for the `mainnet` network, as the contracts have not been deployed there yet.

```TS
file: exports/address.config.ts

import { mainnet, polygon } from 'viem/chains';
import { Address, zeroAddress } from 'viem';

export interface ChainAddress {
	membership: Address;
	storage: Address;
}

export const ADDRESS: Record<number, ChainAddress> = {
	[mainnet.id]: {
		membership: zeroAddress, // if not available
		storage: zeroAddress,
	},
	[polygon.id]: {
		membership: '0x72950A0A9689fCA941Ddc9E1a58dcD3fb792E3D2',
		storage: '0x8A7e8091e71cCB7D1EbDd773C26AD82AAd323328',
	},
};
```

# 7. TSUP and npm package

### 7.1 TSUP

> Config: /tsup.config.ts

TSUP bundles TypeScript code into optimized JavaScript packages. This package uses TSUP to create production-ready builds.

`yarn run build`

### 7.2 NPM Package

> **Increase Version:** Update version number in package.json using semantic versioning (e.g. 0.0.1 -> 0.0.2) before publishing new changes.

```
file: /package.json

"name": "@frankencoin/zchf",
"version": "0.2.16", <-- HERE
```

Login to your NPM account

`npm login`

This will publish your package to NPM with public access, making it **available for anyone to install and use**.

`yarn run publish`

To publish new version. `publish: "npm publish --access public"`

> **Note**: During npm package publishing, the command may execute twice. The second execution will fail with a version conflict since the package is already published. This is expected behavior and the first publish will have succeeded.

### 7.3 How to transpile package into bundled apps

(not needed, since its already a true JS bundled module)

E.g. for `NextJs` using the `next.config.js` in root of project.

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@.../core", "@.../api"],
};

module.exports = nextConfig;
```
