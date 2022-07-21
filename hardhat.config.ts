import { HardhatUserConfig } from "hardhat/config";
import { ethers } from "ethers";
import { SigningKey } from "@ethersproject/signing-key";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.9",
};

//export default config;
const ZERO_PK = "0x0000000000000000000000000000000000000000000000000000000000000000";
let pk: string | SigningKey = <string>process.env.PK;
let wallet;
try {
    wallet = new ethers.Wallet(pk);

}
catch (e) {
    pk = ZERO_PK;
}
export default {
  defaultNetwork: "hardhat",
  networks: {
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
      ropsten: {
          url: "https://ropsten.infura.io/v3/[Project_ID]",
          chainId: 3,
          gas: 6000000,
          // gasPrice: 10000000000,
          accounts: [pk],
          timeout: 300000,
          confirmations: 2,
      },
      // rinkeby: {
      //     url: process.env.RINKEBY_ENDPOINT,
      //     chainId: 4,
      //     gas: 7000000,
      //     // gasPrice: 10000000000,
      //     accounts: [pk],
      //     timeout: 300000,
      //     confirmations: 2,
      // },
      matic: {
          url: "https://polygon-mumbai.infura.io/v3/[Project_ID]",
          chainId: 80001,
          gas: 6000000,
          // gasPrice: 10000000000,
          accounts: [pk],
          timeout: 300000,
          confirmations: 2,
      },
      matic_mumbai: {
          url: "https://matic-mumbai.chainstacklabs.com",
          network_id: 80001,
          accounts: [pk],
          gasPrice: 1000000000,
          gas: 10000000,
          timeout: 300000,
      },
      kovan: {
          url: "https://kovan.infura.io/v3/",
          gasPrice: 1e9,
          // accounts: [""],
          timeout: 300000,
          confirmations: 1,
      },
      bscTestnet: {
          // url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
          // url: "https://data-seed-prebsc-2-s1.binance.org:8545/",
          // url: "https://data-seed-prebsc-1-s2.binance.org:8545/",
          // url: "https://data-seed-prebsc-2-s2.binance.org:8545/",
          // url: "https://data-seed-prebsc-1-s3.binance.org:8545/",
          // url: "https://data-seed-prebsc-2-s3.binance.org:8545/",
          url: "https://bsc.sovryn.app/testnet",
          chainId: 97,
          gas: 6000000,
          accounts: [pk],
          timeout: 300000,
          confirmations: 1,
      },
      bscTestnetCompetition: {
          // url: "https://data-seed-prebsc-1-s1.binance.org:8545/", //
          url: "https://data-seed-prebsc-2-s1.binance.org:8545/",
          // url: "https://data-seed-prebsc-1-s2.binance.org:8545/",
          // url: "https://data-seed-prebsc-2-s2.binance.org:8545/", //
          // url: "https://data-seed-prebsc-1-s3.binance.org:8545/",
          // url: "https://data-seed-prebsc-2-s3.binance.org:8545/", //
          // url: "https://bsc.sovryn.app/testnet/",
          // url: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
          // url: "https://bsctestnet.sovryn.app/",
          chainId: 97,
          gas: 10000000,
          gasPrice: 12e9,
          accounts: [pk],
          timeout: 300000,
          confirmations: 1,
          funds: {
              paymasterAmount: 0.1,
          }
      },
      bscMainnet: {
          // url: "https://bsc-dataseed.binance.org/",
          url: "https://bsc.sovryn.app/mainnet",
          chainId: 56,
          gasPrice: 10e9,
          accounts: [pk],
          timeout: 300000,
          confirmations: 1,
      },
      arb: {
          url: "https://kovan5.arbitrum.io/rpc",
          gasPrice: 3e8,
          chainId: 42161,
          // accounts: [pk],
          timeout: 300000,
          confirmations: 1,
      },
      rsk_testnet: {
          url: "https://testnet.sovryn.app/rpc",
          chainId: 31,
          gas: 6800000,
          gasPrice: 95000010,
          accounts: [pk],
          timeout: 300000,
          confirmations: 1,
      },
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
      enabled: false,
      currency: 'USD',
    },
  abiExporter: {
  path: "./abi",
  clear: true,
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
