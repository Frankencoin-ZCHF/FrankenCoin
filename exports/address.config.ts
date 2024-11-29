import { mainnet, polygon } from "viem/chains";
import { Address, zeroAddress } from "viem";

export interface ChainAddress {
  decentralizedEURO: Address;
  equity: Address;
  DEPSwrapper: Address;
  bridge: Address;
  eurt: Address;
  savings: Address;
  roller: Address;
  mintingHubV2: Address;
  positionFactoryV2: Address;
}

export const ADDRESS: Record<number, ChainAddress> = {
  [mainnet.id]: {
    // natice contract addresses
    decentralizedEURO: "0xd45e911843721083A2751fA9Cc9D2a8089D8C0f5",
    equity: "0xC92aF56C354FCF641f4567a04fd7032013E8A314",
    DEPSwrapper: "0xE699A78B3eC44Ab013f1839305bB1a5a987A05B0",
    bridge: "0x7416E83375C7cb4D74F06F8Dc4Acd4243cEA8248",
    eurt: "0xC581b735A1688071A1746c968e0798D642EDE491",
    savings: "0x4Be3ce63952fd4605d4a6FA4C5F877F6AC73bAa2",
    roller: "0x18fA3796a43c297950f76A1bA6162d58dD2d7EDa",
    mintingHubV2: "0x762FbFA1f0C62a31FBDd91be63b01Fcd392d733B",
    positionFactoryV2: "0x9F67F1FF7A22447b04277A214E9BFaF08d832bb1",
  },
};
