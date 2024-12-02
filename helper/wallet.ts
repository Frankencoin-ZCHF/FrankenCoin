import { ethers } from 'ethers';

export function getChildFromSeed(seed: string, index: number) {
	return ethers.Wallet.fromPhrase(seed).deriveChild(index);
}

export function getAddressFromChildIndex(seed: string, index: number): string {
	return ethers.Wallet.fromPhrase(seed).deriveChild(index).address;
}

export function getPublicKeyFromChildIndex(seed: string, index: number): string {
	return ethers.Wallet.fromPhrase(seed).deriveChild(index).publicKey;
}

export function getPrivateKeyFromChildIndex(seed: string, index: number): string {
	return ethers.Wallet.fromPhrase(seed).deriveChild(index).privateKey;
}
