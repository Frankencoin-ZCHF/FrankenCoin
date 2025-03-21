import { config } from "dotenv";
config();

import { ethers } from "ethers";
import fs from "fs/promises";
import ccipParams from "../deployment/parameters/paramsCCIP.json";
import {
  BridgedGovernance__factory,
  BridgedGovernanceSender__factory,
} from "../../typechain";
import { getRpc } from "./rpcs";

async function main() {
  const alchemyKey = process.env.ALCHEMY_RPC_KEY ?? "";
  const sourceChainName = "sepolia";
  const targetChainName = process.argv[2] ?? "";
  const voters = process.argv[3].split(",");
  const sourceProvider = new ethers.JsonRpcProvider(
    getRpc(sourceChainName, alchemyKey)
  );
  const targetProvider = new ethers.JsonRpcProvider(
    getRpc(targetChainName, alchemyKey)
  );
  console.log(`Sending votes to ${targetChainName}`);
  const sourceWallet = ethers.Wallet.fromPhrase(
    process.env.DEPLOYER_ACCOUNT_SEED ?? "",
    sourceProvider
  );

  const targetParams = ccipParams.find(
    (param) => param.chainName.toLowerCase() === targetChainName.toLowerCase()
  );

  const senderFile = await fs.readFile(
    `scripts/deployment/deployments/${sourceChainName}/BridgedGovernanceSender.json`
  );
  const senderParsed = JSON.parse(senderFile.toString());
  console.log(`Using BridgedGovernanceSender ${senderParsed.address}`);

  const receiverFile = await fs.readFile(
    `scripts/deployment/deployments/${targetChainName}/BridgedGovernance.json`
  );
  const receiverParsed = JSON.parse(receiverFile.toString());
  console.log(
    `Using BridgedGovernance (${receiverParsed.address}) on ${targetChainName} `
  );

  const bridgedGovernanceSender = BridgedGovernanceSender__factory.connect(
    senderParsed.address,
    sourceWallet
  );
  const bridgedGovernance = BridgedGovernance__factory.connect(
    receiverParsed.address,
    targetProvider
  );
  const ccipMessage = await bridgedGovernanceSender.getCCIPMessage(
    receiverParsed.address,
    ethers.ZeroAddress,
    voters,
    "0x"
  );
  const receiveFunc = bridgedGovernance.getFunction("ccipReceive");
  const receiveTx = await receiveFunc.populateTransaction({
    messageId:
      "0x2ccc749c286b1effdf3df51fae94792e1f10b29fbd8a7dc97095448a24b153ab",
    sourceChainSelector: await bridgedGovernance.MAINNET_CHAIN_SELECTOR(),
    sender: ethers.AbiCoder.defaultAbiCoder().encode(
      ["address"],
      [await bridgedGovernance.MAINNET_GOVERNANCE_ADDRESS()]
    ),
    data: ccipMessage.data,
    destTokenAmounts: ccipMessage.tokenAmounts,
  });
  receiveTx.from = await bridgedGovernance.getRouter();
  const gasEstimation = await targetProvider.estimateGas(receiveTx);
  console.log(`Estimated receive uses ${gasEstimation} gas`);

  const functionSelector = ethers.id("CCIP EVMExtraArgsV2").slice(0, 10);
  const extraArgs =
    functionSelector +
    ethers.AbiCoder.defaultAbiCoder()
      .encode(["(uint256, bool)"], [[gasEstimation, true]])
      .slice(2);

  console.log(
    `Getting ccip fee with 
      ${receiverParsed.address} 
      ${targetParams?.chainSelector ?? ""} 
      ${ethers.ZeroAddress} 
      ${voters} 
      ${extraArgs} 
    `
  );

  const ccipFee = await bridgedGovernanceSender.getCCIPFee(
    receiverParsed.address,
    targetParams?.chainSelector ?? "",
    ethers.ZeroAddress,
    voters,
    extraArgs
  );
  console.log(`CCIP Fee: ${ccipFee}`);

  const syncTx = await bridgedGovernanceSender.syncVotesPayNative(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address"],
      [receiverParsed.address]
    ),
    targetParams?.chainSelector ?? "",
    voters,
    extraArgs,
    {
      value: ccipFee,
    }
  );
  console.log(`Sent tx ${syncTx.hash}. Waiting for validators...`);
  await syncTx.wait();
}

main();
