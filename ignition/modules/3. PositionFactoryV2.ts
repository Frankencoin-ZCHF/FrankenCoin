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
export const args = [];
storeConstructorArgs('PositionFactoryV2', args, true);

console.log('Constructor Args');
console.log(args);

// process.exit();

const PositionFactoryV2Module = buildModule('PositionFactoryV2Module', (m) => {
	const controller = m.contract('PositionFactory', args);
	return { controller };
});

export default PositionFactoryV2Module;
