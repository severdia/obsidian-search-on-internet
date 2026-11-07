import * as esbuild from 'esbuild';

const options = {
  entryPoints: ['main.ts'],
  outfile: 'main.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'es2018',
  external: ['obsidian', 'electron'],
};
if (process.argv.includes('--watch')) {
  const context = await esbuild.context(options);
  await context.watch();
} else {
  await esbuild.build(options);
}
