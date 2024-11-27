import { getChildFromSeed } from './wallet';

const seed = process.env.DEPLOYER_ACCOUNT_SEED;
if (!seed) throw new Error('Failed to import the seed string from .env');
console.log('seed:', seed);

for (let i = 0; i < 3; i++) {
	const w = getChildFromSeed(seed, i);
	console.log('Wallet', i);
	console.log({
		address: w.address,
		pubKey: w.publicKey,
		privKey: w.privateKey,
		path: w.path,
		index: w.index,
	});
}
