require("dotenv").config();
import { task } from "hardhat/config";
// import "./misc/typechain-ethers-v5";
import "hardhat-contract-sizer";
import { ethers } from "ethers";
import { SigningKey } from "@ethersproject/signing-key";
import "hardhat-gas-reporter";
import "hardhat-abi-exporter";
import "solidity-coverage";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
// import '@typechain/hardhat';
import '@nomiclabs/hardhat-waffle';
require('hardhat-log-remover');

const ZERO_PK = "0x0000000000000000000000000000000000000000000000000000000000000000";
let pk: string | SigningKey = <string>process.env.PK;
try {
    const w = new ethers.Wallet(pk);
}
catch (e) {
    pk = ZERO_PK;
}

task("accounts", "Prints the list of accounts", async (args, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

task("encode", "Encode calldata")
    .addPositionalParam("sig", "Signature of contract to deploy")
    .addOptionalPositionalParam("args", "Args of function call, seprated by common ','")
    .setAction(async (args, hre) => {
        if (typeof args.args != 'undefined') {
            args.args = args.args.split(',')
        }
        args.sig = args.sig.replace('function ', '')
        var iface = new hre.ethers.utils.Interface(["function " + args.sig])
        var selector = args.sig.slice(0, args.sig.indexOf('('))
        // console.log(args.sig, args.args, selector)
        var calldata = iface.encodeFunctionData(selector, args.args)
        console.log("encoded calldata", calldata)
    })


/*task("deploy", "Deploy a single contract")
    .addPositionalParam("name", "Name of contract to deploy")
    .addOptionalPositionalParam("args", "Args of contract constructor, seprated by common ','")
    .setAction(async (args, hre) => {
        if (typeof args.args != 'undefined') {
            args.args = args.args.split('|')
        }
        const factory = await hre.ethers.getContractFactory(args.name);
        const contract = await factory.deploy(...args.args);
        console.log(args.name, "has been deployed to", contract.address);
    })
*/
task("send", "Call contract function")
    .addPositionalParam("address", "Address of contract")
    .addPositionalParam("sig", "Signature of contract")
    .addOptionalPositionalParam("args", "Args of function call, seprated by common ','")
    .setAction(async (args, hre) => {
        if (typeof args.args != 'undefined') {
            args.args = args.args.split('|')
        }
        args.sig = args.sig.replace('function ', '')
        var iface = new hre.ethers.utils.Interface(["function " + args.sig])
        var selector = args.sig.slice(0, args.sig.indexOf('('))
        // console.log(args.sig, args.args, selector)
        var calldata = iface.encodeFunctionData(selector, args.args)
        // console.log("encoded calldata", calldata)
        const signer = hre.ethers.provider.getSigner(0);

        const tx = await signer.sendTransaction({
            to: args.address,
            from: signer._address,
            data: calldata,
        });
        console.log(tx);
        console.log(await tx.wait());
    })

task("call", "Call contract function")
    .addPositionalParam("address", "Address of contract")
    .addPositionalParam("sig", "Signature of contract")
    .addOptionalPositionalParam("args", "Args of function call, seprated by common ','")
    .setAction(async (args, hre) => {
        if (typeof args.args != 'undefined') {
            args.args = args.args.split('|')
        }
        args.sig = args.sig.replace('function ', '')
        var iface = new hre.ethers.utils.Interface(["function " + args.sig])
        var selector = args.sig.slice(0, args.sig.indexOf('('))
        console.log(args.sig, args.args, selector)
        var calldata = iface.encodeFunctionData(selector, args.args)
        //       console.log("encoded calldata", calldata)
        const signer = hre.ethers.provider.getSigner(0);
        const result = await signer.call({
            to: args.address,
            data: calldata,
        })
        console.log("result", result);
    })

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
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
            // url: "https://data-seed-prebsc-2-s1.binance.org:8545/",
            // url: "https://data-seed-prebsc-1-s2.binance.org:8545/",
            // url: "https://data-seed-prebsc-2-s2.binance.org:8545/",
            // url: "https://data-seed-prebsc-1-s3.binance.org:8545/",
            url: "https://data-seed-prebsc-2-s3.binance.org:8545/",
            chainId: 97,
            // gas: 6000000,
            accounts: [pk],
            timeout: 300000,
            confirmations: 1,
        },
        bscMainnet: {
            url: "https://bsc-dataseed.binance.org/",
            chainId: 56,
            gasPrice: 20e9,
            accounts: [pk],
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
        version: "0.8.0",
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
    }
};
