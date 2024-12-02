import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { getChildFromSeed } from '../../helper/wallet';
import { storeConstructorArgs } from '../../helper/store.args';
import { ADDRESS } from '../../exports/address.config';
import { Chain } from 'viem';

// deployer settings
const seed = process.env.DEPLOYER_ACCOUNT_SEED;
if (!seed) throw new Error('Failed to import the seed string from .env');

const w0 = getChildFromSeed(seed, 0); // deployer

// frankencoin addresses
const id = process.env?.CHAINID || 1;
const ADDR = ADDRESS[id as Chain['id']];

export const config = {
	deployer: w0.address,
	chainId: id,
};

console.log('Config Info');
console.log(config);

// constructor args
export const args = [ADDR.frankenCoin];
storeConstructorArgs('PositionRoller', args, true);

console.log('Constructor Args');
console.log(args);

// buildModule
const PositionRollerModule = buildModule('PositionRollerModule', (m) => {
	const controller = m.contract('PositionRoller', args);
	return { controller };
});

export default PositionRollerModule;
