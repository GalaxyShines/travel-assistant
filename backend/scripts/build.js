const path = require('node:path');
const { build } = require('esbuild');

const backendDir = path.resolve(__dirname, '..');
const modeArgument = process.argv.find((argument) => argument.startsWith('--mode='));
const mode = modeArgument?.slice('--mode='.length) || 'production';

if (!['development', 'production'].includes(mode)) {
  throw new Error(`Unsupported backend build mode: ${mode}`);
}

build({
  entryPoints: [path.join(backendDir, 'src', 'server.js')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: path.join(backendDir, 'dist', 'server.js'),
  define: {
    __BACKEND_MODE__: JSON.stringify(mode)
  }
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
