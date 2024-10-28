export const IPositionFactoryABI = [
	{
		inputs: [
			{
				internalType: 'address',
				name: '_parent',
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
				internalType: 'uint40',
				name: '_initPeriod',
				type: 'uint40',
			},
			{
				internalType: 'uint40',
				name: '_duration',
				type: 'uint40',
			},
			{
				internalType: 'uint40',
				name: '_challengePeriod',
				type: 'uint40',
			},
			{
				internalType: 'uint24',
				name: '_riskPremiumPPM',
				type: 'uint24',
			},
			{
				internalType: 'uint256',
				name: '_liqPrice',
				type: 'uint256',
			},
			{
				internalType: 'uint24',
				name: '_reserve',
				type: 'uint24',
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
