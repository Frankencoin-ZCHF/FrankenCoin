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
		frankenCoin: '0xB58E61C3098d85632Df34EecfB899A1Ed80921cB',
		equity: '0x1bA26788dfDe592fec8bcB0Eaff472a42BE341B2',
		wFPS: '0x5052D3Cc819f53116641e89b96Ff4cD1EE80B182',
		bridge: '0x7bbe8F18040aF0032f4C2435E7a76db6F1E346DF',
		xchf: '0xb4272071ecadd69d933adcd19ca99fe80664fc08',
		savings: zeroAddress,
		roller: zeroAddress,
		mintingHubV1: '0x7546762fdb1a6d9146b33960545C3f6394265219',
		mintingHubV2: zeroAddress,

		bridgePolygonFrankencoin: '0x02567e4b14b25549331fCEe2B56c647A8bAB16FD',
		bridgeArbitrumFrankencoin: '0xB33c4255938de7A6ec1200d397B2b2F329397F9B',
		bridgeOptimismFrankencoin: '0x4F8a84C442F9675610c680990EdDb2CCDDB8aB6f',
		bridgePolygonWfps: '0x54Cc50D5CC4914F0c5DA8b0581938dC590d29b3D',
		bridgeArbitrumWfps: zeroAddress,
		bridgeOptimismWfps: zeroAddress,
	},
	[polygon.id]: {
		// For test deployment only
		frankenCoin: '0xD4Cb1348CD353C434920b5EEAFfC6FE859CeD5D2',
		equity: '0x2F9eC1E24BAa54885E863F1f0aABeEf6cB9f17f7',
		wFPS: '0xc9e1Ba98f4c6328F72a48B820FBAB83cD7498e5A',
		bridge: zeroAddress, // not used
		xchf: zeroAddress, // not used
		savings: '0xfDb3cBD553A735715227d69A39F0752162a9353E',
		roller: '0x18273836c756106A39bAeD304b7Ac5a77483CA19',
		mintingHubV1: '0xc6fccF96751Fb4D088997CA3875c19859105791e',
		mintingHubV2: '0x4AEb26AEF018b87ddf6DE1429456Dbe43c489F3b',
	},
};
