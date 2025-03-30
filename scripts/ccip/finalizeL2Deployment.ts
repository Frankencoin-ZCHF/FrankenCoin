import { config } from "dotenv";
config();

import { ethers } from "ethers";
import { getRpc } from "./rpcs";
import fs from "fs/promises";
import { CCIPAdmin__factory } from "../../typechain";

async function main() {
  const alchemyKey = process.env.ALCHEMY_RPC_KEY ?? "";
  const chainName = process.argv[2] ?? "";

  if (!alchemyKey || !chainName) {
    console.log(
      "Usage: npx ts-node scripts/ccip/finalizeL2Deployment.ts <chainName>"
    );
    process.exit(1);
  }

  const sourceProvider = new ethers.JsonRpcProvider(
    "https://rpc.tenderly.co/fork/a7a16f55-3e69-4f60-9f13-3f91ed143931"
  );
  const sourceWallet = ethers.Wallet.fromPhrase(
    process.env.DEPLOYER_ACCOUNT_SEED ?? "",
    sourceProvider
  );

  const ccipAdminFile = await fs.readFile(
    `scripts/deployment/deployments/${chainName}/CCIPAdmin.json`
  );
  const ccipParsed = JSON.parse(ccipAdminFile.toString());
  console.log(`Using CCIPAdmin ${ccipParsed.address}`);

  const tokenPoolFile = await fs.readFile(
    `scripts/deployment/deployments/${chainName}/BurnMintTokenPool.json`
  );
  const tokenPoolParsed = JSON.parse(tokenPoolFile.toString());
  console.log(`Using BurnMintTokenPool ${tokenPoolParsed.address}`);

  const ccipAdmin = CCIPAdmin__factory.connect(
    ccipParsed.address,
    sourceWallet
  );

  console.log("Finalizing deployment...");
  console.log("Accepting admin...");
  const acceptAdminTx = await ccipAdmin.acceptAdmin();
  console.log(`TX: ${acceptAdminTx.hash}`);
  await acceptAdminTx.wait();
  console.log("Accepting admin... Done");
  console.log(`Setting token pool ${tokenPoolParsed.address}...`);
  const setTokenPoolTx = await ccipAdmin.setTokenPool(tokenPoolParsed.address);
  console.log(`TX: ${setTokenPoolTx.hash}`);
  await setTokenPoolTx.wait();
  console.log("Setting token pool... Done");
  console.log("Accepting ownership...");
  const acceptOwnershipTx = await ccipAdmin.acceptOwnership();
  console.log(`TX: ${acceptOwnershipTx.hash}`);
  await acceptOwnershipTx.wait();
  console.log("Accepting ownership... Done");
}

main();
