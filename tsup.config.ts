import { defineConfig } from 'tsup';

export default defineConfig({
	format: ['cjs', 'esm'],
	entry: ['./exports/index.ts'],
	dts: true,
	shims: true,
	skipNodeModulesBundle: true,
	clean: true,
});
