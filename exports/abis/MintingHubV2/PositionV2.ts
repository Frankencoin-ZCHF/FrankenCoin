export const PositionV2ABI = [
	{
		inputs: [
			{
				internalType: 'address',
				name: '_owner',
				type: 'address',
			},
			{
				internalType: 'address',
				name: '_hub',
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
				name: '_reservePPM',
				type: 'uint24',
			},
		],
		stateMutability: 'nonpayable',
		type: 'constructor',
	},
	{
		inputs: [],
		name: 'Alive',
		type: 'error',
	},
	{
		inputs: [],
		name: 'AlreadyInitialized',
		type: 'error',
	},
	{
		inputs: [],
		name: 'ChallengeTooSmall',
		type: 'error',
	},
	{
		inputs: [],
		name: 'Challenged',
		type: 'error',
	},
	{
		inputs: [],
		name: 'Closed',
		type: 'error',
	},
	{
		inputs: [
			{
				internalType: 'uint40',
				name: 'time',
				type: 'uint40',
			},
			{
				internalType: 'uint40',
				name: 'expiration',
				type: 'uint40',
			},
		],
		name: 'Expired',
		type: 'error',
	},
	{
		inputs: [],
		name: 'Hot',
		type: 'error',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'needed',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'available',
				type: 'uint256',
			},
		],
		name: 'InsufficientCollateral',
		type: 'error',
	},
	{
		inputs: [],
		name: 'InvalidExpiration',
		type: 'error',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'tried',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'available',
				type: 'uint256',
			},
		],
		name: 'LimitExceeded',
		type: 'error',
	},
	{
		inputs: [],
		name: 'NotHub',
		type: 'error',
	},
	{
		inputs: [],
		name: 'NotOriginal',
		type: 'error',
	},
	{
		inputs: [],
		name: 'NotOwner',
		type: 'error',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'excess',
				type: 'uint256',
			},
		],
		name: 'RepaidTooMuch',
		type: 'error',
	},
	{
		inputs: [],
		name: 'TooLate',
		type: 'error',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: 'uint256',
				name: 'collateral',
				type: 'uint256',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'price',
				type: 'uint256',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'minted',
				type: 'uint256',
			},
		],
		name: 'MintingUpdate',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'previousOwner',
				type: 'address',
			},
			{
				indexed: true,
				internalType: 'address',
				name: 'newOwner',
				type: 'address',
			},
		],
		name: 'OwnershipTransferred',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'sender',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'string',
				name: 'message',
				type: 'string',
			},
		],
		name: 'PositionDenied',
		type: 'event',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'newMinted',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'newCollateral',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'newPrice',
				type: 'uint256',
			},
		],
		name: 'adjust',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'newPrice',
				type: 'uint256',
			},
		],
		name: 'adjustPrice',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'annualInterestPPM',
		outputs: [
			{
				internalType: 'uint24',
				name: '',
				type: 'uint24',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'assertCloneable',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'availableForClones',
		outputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'availableForMinting',
		outputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'calculateCurrentFee',
		outputs: [
			{
				internalType: 'uint24',
				name: '',
				type: 'uint24',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'exp',
				type: 'uint256',
			},
		],
		name: 'calculateFee',
		outputs: [
			{
				internalType: 'uint24',
				name: '',
				type: 'uint24',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'challengeData',
		outputs: [
			{
				internalType: 'uint256',
				name: 'liqPrice',
				type: 'uint256',
			},
			{
				internalType: 'uint40',
				name: 'phase',
				type: 'uint40',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'challengePeriod',
		outputs: [
			{
				internalType: 'uint40',
				name: '',
				type: 'uint40',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'challengedAmount',
		outputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'collateral',
		outputs: [
			{
				internalType: 'contract IERC20',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'cooldown',
		outputs: [
			{
				internalType: 'uint40',
				name: '',
				type: 'uint40',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address[]',
				name: 'helpers',
				type: 'address[]',
			},
			{
				internalType: 'string',
				name: 'message',
				type: 'string',
			},
		],
		name: 'deny',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'expiration',
		outputs: [
			{
				internalType: 'uint40',
				name: '',
				type: 'uint40',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'buyer',
				type: 'address',
			},
			{
				internalType: 'uint256',
				name: 'collAmount',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'proceeds',
				type: 'uint256',
			},
		],
		name: 'forceSale',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'usableMint',
				type: 'uint256',
			},
		],
		name: 'getMintAmount',
		outputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'totalMint',
				type: 'uint256',
			},
			{
				internalType: 'bool',
				name: 'afterFees',
				type: 'bool',
			},
		],
		name: 'getUsableMint',
		outputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'hub',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'parent',
				type: 'address',
			},
			{
				internalType: 'uint40',
				name: '_expiration',
				type: 'uint40',
			},
		],
		name: 'initialize',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'isClosed',
		outputs: [
			{
				internalType: 'bool',
				name: '',
				type: 'bool',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'limit',
		outputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'minimumCollateral',
		outputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'target',
				type: 'address',
			},
			{
				internalType: 'uint256',
				name: 'amount',
				type: 'uint256',
			},
		],
		name: 'mint',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'minted',
		outputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'size',
				type: 'uint256',
			},
		],
		name: 'notifyChallengeAverted',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'size',
				type: 'uint256',
			},
		],
		name: 'notifyChallengeStarted',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: '_bidder',
				type: 'address',
			},
			{
				internalType: 'uint256',
				name: '_size',
				type: 'uint256',
			},
		],
		name: 'notifyChallengeSucceeded',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
			{
				internalType: 'uint32',
				name: '',
				type: 'uint32',
			},
		],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'mint_',
				type: 'uint256',
			},
		],
		name: 'notifyMint',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'repaid_',
				type: 'uint256',
			},
		],
		name: 'notifyRepaid',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'original',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'owner',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'price',
		outputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'amount',
				type: 'uint256',
			},
		],
		name: 'repay',
		outputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
		],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'reserveContribution',
		outputs: [
			{
				internalType: 'uint24',
				name: '',
				type: 'uint24',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'riskPremiumPPM',
		outputs: [
			{
				internalType: 'uint24',
				name: '',
				type: 'uint24',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'start',
		outputs: [
			{
				internalType: 'uint40',
				name: '',
				type: 'uint40',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'newOwner',
				type: 'address',
			},
		],
		name: 'transferOwnership',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'token',
				type: 'address',
			},
			{
				internalType: 'address',
				name: 'target',
				type: 'address',
			},
			{
				internalType: 'uint256',
				name: 'amount',
				type: 'uint256',
			},
		],
		name: 'withdraw',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'target',
				type: 'address',
			},
			{
				internalType: 'uint256',
				name: 'amount',
				type: 'uint256',
			},
		],
		name: 'withdrawCollateral',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'zchf',
		outputs: [
			{
				internalType: 'contract IFrankencoin',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
] as const;
