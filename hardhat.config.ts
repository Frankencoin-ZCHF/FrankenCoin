import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-ignition-ethers";
import "hardhat-deploy";
import "hardhat-abi-exporter";
import "hardhat-contract-sizer";
import { HardhatUserConfig } from "hardhat/config";
import { getChildFromSeed } from "./helper/wallet";

import dotenv from "dotenv";
dotenv.config();

const seed = process.env.DEPLOYER_ACCOUNT_SEED;
if (!seed) throw new Error("Failed to import the seed string from .env");
const w0 = getChildFromSeed(seed, 0); // deployer

const alchemy = process.env.ALCHEMY_RPC_KEY;
if (alchemy?.length == 0 || !alchemy)
  console.log("WARN: No Alchemy Key found in .env");

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
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
    mainnet: {
      url: `https://eth-mainnet.g.alchemy.com/v2/${alchemy}`,
      chainId: 1,
      gas: "auto",
      gasPrice: "auto",
      accounts: [w0.privateKey],
      timeout: 50_000,
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${alchemy}`,
      chainId: 11155111,
      gas: "auto",
      gasPrice: "auto",
      accounts: [w0.privateKey],
      timeout: 50_000,
    },
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${alchemy}`,
      chainId: 137,
      gas: "auto",
      gasPrice: "auto",
      accounts: [w0.privateKey],
      timeout: 50_000,
    },
    amoy: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${alchemy}`,
      chainId: 80002,
      gas: "auto",
      gasPrice: "auto",
      accounts: [w0.privateKey],
      timeout: 50_000,
      // @ts-expect-error Urls is valid but not in the typings...
      urls: {
        apiURL: "https://api-amoy.polygonscan.com/api",
        browserURL: "https://amoy.polygonscan.com"
      },
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  etherscan: {
    apiKey: {
      sepolia:process.env.ETHERSCAN_API || '',
      polygonAmoy: process.env.POLYGONSCAN_API || '',
    }
  },
  sourcify: {
    enabled: true,
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
  abiExporter: [
    {
      path: "./abi",
      clear: true,
      runOnCompile: true,
      flat: false,
      spacing: 4,
      pretty: false,
    },
    {
      path: "./abi/signature",
      clear: true,
      runOnCompile: true,
      flat: false,
      spacing: 4,
      pretty: true,
    },
  ],
  mocha: {
    timeout: 120000,
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v6",
  },
};

export default config;
