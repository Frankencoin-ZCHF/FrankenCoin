import { config } from "dotenv";
config();

import { ethers } from "ethers";
import fs from "fs/promises";
import { CCIPAdmin__factory } from "../../typechain";
import ccipParams from "../deployment/parameters/paramsCCIP.json";
import { getRpc } from "./rpcs";

async function main() {
  const alchemyKey = process.env.ALCHEMY_RPC_KEY ?? "";
  const sourceChainName = process.argv[2] ?? "";
  const targetChainName = process.argv[3] ?? "";
  const sourceProvider = new ethers.JsonRpcProvider(
    getRpc(sourceChainName, alchemyKey)
  );
  const sourceWallet = ethers.Wallet.fromPhrase(
    process.env.DEPLOYER_ACCOUNT_SEED ?? "",
    sourceProvider
  );

  const ccipAdminFile = await fs.readFile(
    `scripts/deployment/deployments/${sourceChainName}/CCIPAdmin.json`
  );
  const ccipParsed = JSON.parse(ccipAdminFile.toString());
  console.log(`Using CCIPAdmin ${ccipParsed.address}`);
  const ccipAdmin = CCIPAdmin__factory.connect(
    ccipParsed.address,
    sourceWallet
  );

  const targetParams = ccipParams.find(
    (param) => param.chainName.toLowerCase() === targetChainName.toLowerCase()
  );

  const updateData = ethers.AbiCoder.defaultAbiCoder().encode(
    [
      "(uint64[] chainsToRemove, (uint64 remoteChainSelector, bytes[] remotePoolAddresses, bytes remoteTokenAddress, (bool isEnabled, uint128 capacity, uint128 rate) outboundRateLimiterConfig, (bool isEnabled, uint128 capacity, uint128 rate) inboundRateLimiterConfig)[] chainsToAdd)",
    ],
    [
      {
        chainsToRemove: [],
        chainsToAdd: [
          {
            inboundRateLimiterConfig: {
              capacity: 0,
              isEnabled: false,
              rate: 0,
            },
            outboundRateLimiterConfig: {
              capacity: 0,
              isEnabled: false,
              rate: 0,
            },
            remoteChainSelector: targetParams?.chainSelector ?? 0,
            remotePoolAddresses: [
              ethers.AbiCoder.defaultAbiCoder().encode(
                ["address"],
                [targetParams?.tokenPool ?? ""]
              ),
            ],
            remoteTokenAddress: ethers.AbiCoder.defaultAbiCoder().encode(
              ["address"],
              [targetParams?.zchf ?? ""]
            ),
          },
        ],
      },
    ]
  );

  const tx = await ccipAdmin.applyProposal(2, updateData);
  await tx.wait();
  console.log(`Proposal applied ${tx.hash}`);
}

main();
