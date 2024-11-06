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
		frankenCoin: '0xe1E977f254e49b481497055B7F7d392578643725',
		equity: '0xd1a4A36EED03732e0917FDc0139470e2F4dCC958',
		wFPS: '0x1a3c8cf82668FE4C963576A9bE899E546B7712Bf',
		bridge: zeroAddress, // not used
		xchf: zeroAddress, // not used
		savings: '0xbe542a99A2A434eBB004A52745153aA125dfA597',
		roller: '0x1D7838826CF26C6Ed91c2522188Cf404eacA2074',
		mintingHubV1: '0xbb67FD6a38f4a2fcBD102a09c86a0207F76A17cb',
		mintingHubV2: '0xF8db5D24F55dD0cF5BA04cD12A33a6916A7F19fA',
	},
};
