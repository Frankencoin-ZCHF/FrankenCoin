import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-network-helpers";
import "hardhat-deploy";
import "hardhat-abi-exporter";
import "hardhat-contract-sizer";
import { HardhatUserConfig } from "hardhat/config";
import { SigningKey } from "@ethersproject/signing-key";

import dotenv from "dotenv";
dotenv.config();

//export default config;
const DEFAULT_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // do not send ETH to this account

let pk: string | SigningKey = <string>process.env.PK == null ? DEFAULT_PK : <string>process.env.PK;
let etherscanapikey: string = <string>process.env.APIKEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["storageLayout"],
        },
      },
    },
  },
  networks: {
    sepolia: {
      url: "https://ethereum-sepolia.blockpi.network/v1/rpc/public",
      chainId: 11155111,
      gas: 50_000,
      gasPrice: "auto",
      accounts: [pk],
      timeout: 50_000,
    },
    mainnet: {
      url: "https://ethereum.publicnode.com",
      chainId: 1,
      gas: 50_000,
      gasPrice: "auto",
      accounts: [pk],
      timeout: 50_000,
    },
    goerli: {
      url: "https://goerli.infura.io/v3/",
      chainId: 5,
      gas: "auto",
      gasPrice: "auto",
      accounts: [pk],
      timeout: 50000,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  etherscan: {
    apiKey: etherscanapikey,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./scripts/deployment/deploy",
    deployments: "./scripts/deployment/deployments",
  },
  contractSizer: {
    alphaSort: false,
    runOnCompile: false,
    disambiguatePaths: false,
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
  abiExporter: {
    path: "./abi",
    clear: true,
    runOnCompile: true,
    flat: true,
    spacing: 4,
    pretty: false,
  },
  mocha: {
    timeout: 120000,
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v6",
  },
};

export default config;
