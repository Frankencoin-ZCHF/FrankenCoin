import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { getChildFromSeed } from '../../helper/wallet';
import { storeConstructorArgs } from '../../helper/store.args';

const seed = process.env.DEPLOYER_ACCOUNT_SEED;
if (!seed) throw new Error('Failed to import the seed string from .env');

const w0 = getChildFromSeed(seed, 0); // deployer

export const config = {
	deployer: w0.address,
};

console.log('Config Info');
console.log(config);

// constructor args
export const args = [config.admin, config.executor, config.member];
storeConstructorArgs('deployment01', args);

console.log('Constructor Args');
console.log(args);

const MembershipV0Module = buildModule('', (m) => {
	const controller = m.contract('MembershipV0', args);
	return { controller };
});

export default MembershipV0Module;
