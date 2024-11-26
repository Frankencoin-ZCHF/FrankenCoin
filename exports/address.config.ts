import { mainnet, polygon } from "viem/chains";
import { Address, zeroAddress } from "viem";

export interface ChainAddress {
  eurocoin: Address;
  equity: Address;
  deps: Address;
  bridge: Address;

  // accept any optional key
  [key: string]: Address | undefined;
}

export const ADDRESS: Record<number, ChainAddress> = {
  [mainnet.id]: {
    // natice contract addresses
    eurocoin: "0xd45e911843721083A2751fA9Cc9D2a8089D8C0f5",
    equity: "0xC92aF56C354FCF641f4567a04fd7032013E8A314",
    deps: zeroAddress,
    bridge: zeroAddress,
  },
  [polygon.id]: {
    // For test deployment only
    eurocoin: "0xdd537c07AAf1Be13b396EB37B2a2E41034002C94",
    equity: "0x87f562A2ACb54134fD8203911Ca65Ca366062afF",
    deps: "0x00b589940EE4274129a87428143E6F15a1993743",
    bridge: zeroAddress,
  },
};
