# FrankenCoin Genesis

It shall support a wide range of collateralized minting methods that are governed by a democratic process.
See 
* Find more details under [website](website/frontpage.md)
* [Frankencoin Research Paper](https://www.snb.ch/n/mmr/reference/sem_2022_06_03_maire/source/sem_2022_06_03_maire.n.pdf)
## Contracts overview

| Contract      | Description |
| ----------- | ----------- |
| Frankencoin.sol       | Contract for the ZCHF IERC20 token |
| ReservePool.sol       | Contract that holds ZCHF reserve and issues pool tokens |
| MintingHub.sol        | Handles auctions and initiates positions (Position.sol) |
| Position.sol          | A collateralized position |
| StablecoinBridge.sol  | Implementation of a 'bridge-plugin' |
| IFrankencoin.sol      | Interface |
| IReservePool.sol      | Interface |
| IERC677Receiver.sol   | Standard |
| Ownable.sol           | Standard |
| IERC20.sol            | Standard |
| ERC20.sol             | Standard |

## Fee calibration 
See 
[Frankencoin Research Paper](https://www.snb.ch/n/mmr/reference/sem_2022_06_03_maire/source/sem_2022_06_03_maire.n.pdf)

Calculation examples in [Risk folder](Risk/parameters.py)

# Hardhat
It's best to install hardhat via [nvm](https://heynode.com/tutorial/install-nodejs-locally-nvm/).
Once installed, try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
GAS_REPORT=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```
