import { mainnet, polygon } from 'viem/chains';
import { Address, zeroAddress } from 'viem';

export interface ChainAddress {
	frankenCoin: Address;
	equity: Address;
	wFPS: Address;
	bridge: Address;
	xchf: Address;
	leadrate: Address;
	savings: Address;
	roller: Address;
	mintingHubV1: Address;
	positionFactoryV1: Address;
	mintingHubV2: Address;
	positionFactoryV2: Address;

	bridgePolygonFrankencoin?: Address;
	bridgePolygonWfps?: Address;
	bridgeArbitrumFrankencoin?: Address;
	bridgeArbitrumWfps?: Address;
	bridgeOptimismFrankencoin?: Address;
	bridgeOptimismWfps?: Address;

	// accept any optional key
	// [key: string]: Address | undefined;
}

export const ADDRESS: Record<number, ChainAddress> = {
	[mainnet.id]: {
		// natice contract addresses
		frankenCoin: '0xB58E61C3098d85632Df34EecfB899A1Ed80921cB',
		equity: '0x1bA26788dfDe592fec8bcB0Eaff472a42BE341B2',
		wFPS: '0x5052D3Cc819f53116641e89b96Ff4cD1EE80B182',
		bridge: '0x7bbe8F18040aF0032f4C2435E7a76db6F1E346DF',
		xchf: '0xb4272071ecadd69d933adcd19ca99fe80664fc08',
		leadrate: zeroAddress,
		savings: zeroAddress,
		roller: zeroAddress,
		mintingHubV1: '0x7546762fdb1a6d9146b33960545C3f6394265219',
		positionFactoryV1: zeroAddress,
		mintingHubV2: zeroAddress,
		positionFactoryV2: zeroAddress,

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
		frankenCoin: '0x01a3F7FeC57F907cdaFc2be49D844a8259B066c0',
		equity: '0xc6764a90322d58B252AcCA64DBaaeF6AA7a70cDD',
		wFPS: '0x2993F73d87cadbaa9F282408D469B4AB96e3B70F',
		bridge: zeroAddress, // not used
		xchf: zeroAddress, // not used
		leadrate: zeroAddress,
		savings: '0x3E76D80f3531cfEb7C1b5F9a1A30Be6e9c182565',
		roller: '0x9b128C790696b52F85CD9C6827305F8e8B6f9E9E',
		mintingHubV1: '0x8CFd8281e03908Bfeb36DCa9bFAE95Beef6568F6',
		positionFactoryV1: zeroAddress,
		mintingHubV2: '0x99742cE227C315BcAeDF032f281a9BB8B7D94d65',
		positionFactoryV2: zeroAddress,
	},
};
