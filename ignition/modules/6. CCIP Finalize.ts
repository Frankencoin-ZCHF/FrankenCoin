import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { getChildFromSeed } from "../../helper/wallet";
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

const CCIPFinalizeModule = buildModule("CCIPFinalize", (m) => {
  const ccipAdmin = m.contractAt("CCIPAdmin", ADDR.ccipAdmin);
  m.call(ccipAdmin, "acceptAdmin", []);
  const setPool = m.call(ccipAdmin, "setTokenPool", [ADDR.tokenPool]);
  m.call(ccipAdmin, "acceptOwnership", [], {
    after: [setPool],
  });

  return {};
});

export default CCIPFinalizeModule;
