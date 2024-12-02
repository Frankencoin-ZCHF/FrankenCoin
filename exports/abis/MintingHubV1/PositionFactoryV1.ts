export const PositionFactoryV1ABI = [
	{
		inputs: [
			{
				internalType: 'address',
				name: '_existing',
				type: 'address',
			},
		],
		name: 'clonePosition',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: '_owner',
				type: 'address',
			},
			{
				internalType: 'address',
				name: '_zchf',
				type: 'address',
			},
			{
				internalType: 'address',
				name: '_collateral',
				type: 'address',
			},
			{
				internalType: 'uint256',
				name: '_minCollateral',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: '_initialLimit',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: '_initPeriod',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: '_duration',
				type: 'uint256',
			},
			{
				internalType: 'uint64',
				name: '_challengePeriod',
				type: 'uint64',
			},
			{
				internalType: 'uint32',
				name: '_annualInterestPPM',
				type: 'uint32',
			},
			{
				internalType: 'uint256',
				name: '_liqPrice',
				type: 'uint256',
			},
			{
				internalType: 'uint32',
				name: '_reserve',
				type: 'uint32',
			},
		],
		name: 'createNewPosition',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'nonpayable',
		type: 'function',
	},
] as const;
