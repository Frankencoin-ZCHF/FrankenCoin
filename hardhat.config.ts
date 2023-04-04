import { HardhatUserConfig } from "hardhat/config";
import { ethers } from "ethers";
import { SigningKey } from "@ethersproject/signing-key";
import "@nomiclabs/hardhat-etherscan";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import "hardhat-abi-exporter";
import { error } from "console";
const config: HardhatUserConfig = {
  solidity: "0.8.13",
};

//export default config;
const ZERO_PK = "0x0000000000000000000000000000000000000000000000000000000000000000";
let pk: string | SigningKey = <string>process.env.PK;
let etherscanapikey: string = <string>process.env.APIKEY;
let wallet;
try {
    wallet = new ethers.Wallet(pk);
}
catch (e) {
    pk = ZERO_PK;
}
if (pk!=ZERO_PK && etherscanapikey=="") {
    error("define api key for polygonscan: export APIKEY=...")
}

export default {
  defaultNetwork: "hardhat",
  networks: {
    //https://hardhat.org/hardhat-runner/docs/config
      hardhat: {
          chainId: 31337,
          // hardfork: "istanbul",
          allowUnlimitedContractSize: true,
          saveDeployments: true,
          timeout: 30000000,
          // forking: {
          //     enabled: true,
          //     url: process.env.RINKEBY_ENDPOINT,
          //     blockNumber: 9664123
          // }
      },
      localhost: {
          // exposed node of hardhat network:
          // 1. hh node --network hardhat
          // 2. hh deploy --network localhost
          chainId: 31337,
          allowUnlimitedContractSize: true,
          timeout: 30000000,
          url: "http://localhost:8545",
      },
      sepolia: {
        //url: "https://sepolia.etherscan.io",
        // currency SEP
        // https://sepolia.dev/#
        //url: "https://rpc.sepolia.dev",
        //url: "https://rpc.sepolia.dev",
        //url: "https://rpc.sepolia.online",
        //url: "https://www.sepoliarpc.space",
        url: "https://rpc.sepolia.org",
        //url: "https://rpc-sepolia.rockx.com",
        chainId: 11155111,
        gas: 50_000,
        gasPrice: "auto",
        accounts: [pk],
        timeout: 50_000,
        confirmations: 1,
     },
     mainnet: {
      url: "https://ethereum.publicnode.com",
      //url: "https://rpc-sepolia.rockx.com",
      chainId: 1,
      gas: 50_000,
      gasPrice: "auto",
      accounts: [pk],
      timeout: 50_000,
      confirmations: 1,
    },
     goerli: {
        url: "https://goerli.infura.io/v3/",
        chainId: 5,
        gas: "auto",
        gasPrice: "auto",
        accounts: [pk],
        timeout: 50000,
        confirmations: 1,
     }
  },
  etherscan: {
    apiKey: etherscanapikey,
  },
  solidity: {
      version: "0.8.13",
      settings: {
          optimizer: {
              enabled: true,
              runs: 200
              },
              outputSelection: {
              "*": {
                      "*": ["storageLayout"]
                  }
              }
      }
  },
  paths: {
      sources: "./contracts",
      tests: "./test",
      cache: "./cache",
      artifacts: "./artifacts",
      abi: "./abi",
      deploy: "./scripts/deployment/deploy",
      deployments: './scripts/deployment/deployments'
  },
  contractSizer: {
      alphaSort: false,
      runOnCompile: false,
      disambiguatePaths: false,
  },
  gasReporter: {
      enabled: true,
      currency: 'USD',
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
      timeout: 120000
  },
  namedAccounts: {
      deployer: 0
  },
  typechain: {
  outDir: 'typechain',
  target: 'ethers-v5'
},
} as HardhatUserConfig;
