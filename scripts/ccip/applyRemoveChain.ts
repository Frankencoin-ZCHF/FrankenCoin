import { config } from "dotenv";
config();

import { ethers } from "ethers";
import { CCIPAdmin__factory } from "../../typechain";
import ccipParams from "../deployment/parameters/paramsCCIP.json";
import { getRpc } from "./rpcs";

async function main() {
  const alchemyKey = process.env.ALCHEMY_RPC_KEY ?? "";
  const sourceChainName = process.argv[2] ?? "";
  const sourceCcipAdmin = process.argv[3] ?? "";
  const targetChainName = process.argv[4] ?? "";
  const sourceProvider = new ethers.JsonRpcProvider(
    getRpc(sourceChainName, alchemyKey)
  );
  const sourceWallet = ethers.Wallet.fromPhrase(
    process.env.DEPLOYER_ACCOUNT_SEED ?? "",
    sourceProvider
  );

  console.log(`Using CCIPAdmin ${sourceCcipAdmin}`);
  const ccipAdmin = CCIPAdmin__factory.connect(sourceCcipAdmin, sourceWallet);

  const targetParams = ccipParams.find(
    (param) => param.chainName.toLowerCase() === targetChainName.toLowerCase()
  );

  const tx = await ccipAdmin.applyRemoveChain(targetParams?.chainSelector ?? 0);
  await tx.wait();
  console.log(`Proposal sent ${tx.hash}`);
}

main();
