const assert = require('node:assert/strict');
const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const configModule = require('../src/config');

test('command line mode selects the requested backend environment', () => {
  assert.equal(typeof configModule.resolveMode, 'function');
  assert.equal(
    configModule.resolveMode({ argv: ['node', 'server.js', '--mode=production'], env: {} }),
    'production'
  );
  assert.equal(
    configModule.resolveMode({ argv: ['node', 'server.js', '--mode=development'], env: {} }),
    'development'
  );
});

test('mode-specific environment file takes precedence over the generic fallback', async () => {
  assert.equal(typeof configModule.loadEnvironment, 'function');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'travel-helper-env-'));

  try {
    await writeFile(path.join(directory, '.env'), 'BACKEND_PORT=1000\n', 'utf8');
    await writeFile(path.join(directory, '.env.development'), 'BACKEND_PORT=2000\n', 'utf8');
    const targetEnv = {};

    const loadedPath = configModule.loadEnvironment({
      directory,
      mode: 'development',
      targetEnv
    });

    assert.equal(loadedPath, path.join(directory, '.env.development'));
    assert.equal(targetEnv.BACKEND_PORT, '2000');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('missing mode-specific environment file falls back to .env', async () => {
  assert.equal(typeof configModule.loadEnvironment, 'function');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'travel-helper-env-'));

  try {
    await writeFile(path.join(directory, '.env'), 'BACKEND_PORT=3000\n', 'utf8');
    const targetEnv = {};

    const loadedPath = configModule.loadEnvironment({
      directory,
      mode: 'production',
      targetEnv
    });

    assert.equal(loadedPath, path.join(directory, '.env'));
    assert.equal(targetEnv.BACKEND_PORT, '3000');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
