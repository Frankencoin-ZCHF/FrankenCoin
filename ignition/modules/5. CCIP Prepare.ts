import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { getChildFromSeed } from "../../helper/wallet";
import { storeConstructorArgs } from "../../helper/store.args";
import { ADDRESS } from "../../exports/address.config";
import { Chain } from "viem";

const seed = process.env.DEPLOYER_ACCOUNT_SEED;
if (!seed) throw new Error("Failed to import the seed string from .env");

const w0 = getChildFromSeed(seed, 0); // deployer

// frankencoin addresses
const id = process.env?.CHAINID || 1;
const ADDR = ADDRESS[id as Chain["id"]];

export const config = {
  deployer: w0.address,
  ecosystem: ADDR,
};

console.log("Config Info");
console.log(config);

// ccip admin constructor args
export const ccipAdminArgs = [
  ADDR.equity,
  ADDR.tokenAdminRegistry,
  300,
  ADDR.frankenCoin,
];
storeConstructorArgs("CCIPAdmin", ccipAdminArgs, true);

console.log("CCIPAdmin Constructor Args");
console.log(ccipAdminArgs);

// token pool constructor args
export const tokenPoolArgs = [
  ADDR.frankenCoin,
  18,
  [],
  ADDR.rmnProxy,
  ADDR.router,
];
storeConstructorArgs("BurnMintTokenPool", tokenPoolArgs, true);

console.log("BurnMintTokenPool Construcotr Args");
console.log(tokenPoolArgs);

// governance sender
export const bridgedGovernanceSenderArgs = [ADDR.equity, ADDR.router];
storeConstructorArgs("BridgedGovernanceSender", bridgedGovernanceSenderArgs, true);
console.log("BridgedGovernanceSender Constructor Aargs");
console.log(bridgedGovernanceSenderArgs);

const CCIPPrepareModule = buildModule("CCIPPrepare", (m) => {
  const ccipAdmin = m.contract("CCIPAdmin", ccipAdminArgs); // @dev: it uses the Contract name as an identifier
  const tokenPool = m.contract("BurnMintTokenPool", tokenPoolArgs);
  const bridgedGovernanceSender = m.contract("BridgedGovernanceSender", bridgedGovernanceSenderArgs);

  m.call(tokenPool, "transferOwnership", [ccipAdmin]);

  return { ccipAdmin, tokenPool, bridgedGovernanceSender };
});

export default CCIPPrepareModule;
