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
		frankenCoin: '0x9624ed6f4841351F50f2b8A3f47181B37F440f0E',
		equity: '0x89A3C75996b5452aFa1322dfA56a23B6f4ea83F3',
		wFPS: '0xcfD99D34D67B8b8166a33c6866672B65c75c792a',
		bridge: zeroAddress, // not used
		xchf: zeroAddress, // not used
		savings: '0x5237BF853C1DA1c4f2Cf08AF7D3cb7A75b3E62Dc',
		roller: '0x043047431De71160Ed5BF2c04eD70C763801EE6b',
		mintingHubV1: '0x4F257758c18F27bd5d24d82BBDa52EE906DFdAD9',
		mintingHubV2: '0x4C9129f17864c22184b119Ff792877AA5AeE1822',
	},
};
