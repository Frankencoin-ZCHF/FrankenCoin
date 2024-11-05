import { mainnet, polygon } from 'viem/chains';
import { Address, zeroAddress } from 'viem';

export interface ChainAddress {
	frankenCoin: Address;
	equity: Address;
	wFPS: Address;
	bridge: Address;
	xchf: Address;
	savings: Address;
	roller: Address;
	mintingHubV1: Address;
	mintingHubV2: Address;

	bridgePolygonFrankencoin?: Address;
	bridgePolygonWfps?: Address;
	bridgeArbitrumFrankencoin?: Address;
	bridgeArbitrumWfps?: Address;
	bridgeOptimismFrankencoin?: Address;
	bridgeOptimismWfps?: Address;

	// accept any optional key
	[key: string]: Address | undefined;
}

export const ADDRESS: Record<number, ChainAddress> = {
	[mainnet.id]: {
		// natice contract addresses
		frankenCoin: '0xB58E61C3098d85632Df34EecfB899A1Ed80921cB',
		equity: '0x1bA26788dfDe592fec8bcB0Eaff472a42BE341B2',
		wFPS: '0x5052D3Cc819f53116641e89b96Ff4cD1EE80B182',
		bridge: '0x7bbe8F18040aF0032f4C2435E7a76db6F1E346DF',
		xchf: '0xb4272071ecadd69d933adcd19ca99fe80664fc08',
		savings: zeroAddress,
		roller: zeroAddress,
		mintingHubV1: '0x7546762fdb1a6d9146b33960545C3f6394265219',
		mintingHubV2: zeroAddress,

		// bridge contracts for ZCHF
		bridgePolygonFrankencoin: '0x02567e4b14b25549331fCEe2B56c647A8bAB16FD',
		bridgeArbitrumFrankencoin: '0xB33c4255938de7A6ec1200d397B2b2F329397F9B',
		bridgeOptimismFrankencoin: '0x4F8a84C442F9675610c680990EdDb2CCDDB8aB6f',

		// bridge contracts for WFPS
		bridgePolygonWfps: '0x54Cc50D5CC4914F0c5DA8b0581938dC590d29b3D',
		bridgeArbitrumWfps: zeroAddress,
		bridgeOptimismWfps: zeroAddress,
	},
	[polygon.id]: {
		// For test deployment only
		frankenCoin: '0x1F2a2Bc27e093A06aA715526f6577d947a3588f3',
		equity: '0xACd400FAdDf0bB2FDc1E6134558cdF5d2C3b3c34',
		wFPS: '0xCe030cF8BeB3DabcCc877fE090e4B810b89a987b',
		bridge: zeroAddress, // not used
		xchf: zeroAddress, // not used
		savings: '0x426143F64d97bA01e003C0d53ca491d39dBf3eF9',
		roller: '0x8E2bd1F545f1d7575CCa37b1739D23FEdD8eC959',
		mintingHubV1: '0xD5720CA1CD67C12E5dc92a0e3Cd1b9e6a85E6b41',
		mintingHubV2: '0x4FAab35649a4fB6239BE391BDBaC35c15509AdA4',
	},
};
