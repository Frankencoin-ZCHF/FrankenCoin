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
    bridgeEURS: "0xA719b0D3f447118632fECc48c3273224D1319099"
    bridgeVEUR: "0x289BDB83952D4217F5DB59fD7c777b84792cb039"
    bridgeEURC: "0xD5C411355fdb4E3B38FA17a1A5E541474aBf1e76"
    eurt: "0xC581b735A1688071A1746c968e0798D642EDE491",
    eurs: "0xdb25f211ab05b1c97d595516f45794528a807ad8"
    veur: "0x6ba75d640bebfe5da1197bb5a2aff3327789b5d3"
    eurc: "0x6ba75d640bebfe5da1197bb5a2aff3327789b5d3"
    savings: "0x4Be3ce63952fd4605d4a6FA4C5F877F6AC73bAa2",
    roller: "0x18fA3796a43c297950f76A1bA6162d58dD2d7EDa",
    mintingHubV2: "0x762FbFA1f0C62a31FBDd91be63b01Fcd392d733B",
    positionFactoryV2: "0x9F67F1FF7A22447b04277A214E9BFaF08d832bb1",
  },
};
