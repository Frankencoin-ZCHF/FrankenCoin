import { ethers } from "ethers";

export function getChildFromSeed(seed: string, index: number) {
  return ethers.HDNodeWallet.fromPhrase(
    seed,
    undefined,
    `m/44'/60'/0'/0/${index}`
  );
}

export function getAddressFromChildIndex(seed: string, index: number): string {
  return getChildFromSeed(seed, index).address;
}

export function getPublicKeyFromChildIndex(
  seed: string,
  index: number
): string {
  return getChildFromSeed(seed, index).publicKey;
}

export function getPrivateKeyFromChildIndex(
  seed: string,
  index: number
): string {
  return getChildFromSeed(seed, index).privateKey;
}
