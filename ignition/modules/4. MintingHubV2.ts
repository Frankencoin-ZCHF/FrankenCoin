import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { getChildFromSeed } from '../../helper/wallet';
import { storeConstructorArgs } from '../../helper/store.args';
import { ADDRESS } from '../../exports/address.config';
import { Chain } from 'viem';

const seed = process.env.DEPLOYER_ACCOUNT_SEED;
if (!seed) throw new Error('Failed to import the seed string from .env');

const w0 = getChildFromSeed(seed, 0); // deployer

// frankencoin addresses
const id = process.env?.CHAINID || 1;
const ADDR = ADDRESS[id as Chain['id']];

export const config = {
	deployer: w0.address,
	ecosystem: ADDR,
};

console.log('Config Info');
console.log(config);

// constructor args
export const args = [ADDR.frankenCoin, ADDR.savings, ADDR.roller, ADDR.positionFactoryV2];
storeConstructorArgs('MintingHubV2', args, true);

console.log('Constructor Args');
console.log(args);

const MintingHubV2Module = buildModule('MintingHubV2Module', (m) => {
	const controller = m.contract('MintingHub', args); // @dev: it uses the Contract name as an identifier

	return { controller };
});

export default MintingHubV2Module;
