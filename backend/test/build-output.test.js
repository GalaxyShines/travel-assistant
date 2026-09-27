const assert = require('node:assert/strict');
const { execFile, spawn } = require('node:child_process');
const { mkdtemp, copyFile, readFile, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const test = require('node:test');

const execFileAsync = promisify(execFile);
const backendDir = path.resolve(__dirname, '..');
const bundledServer = path.join(backendDir, 'dist', 'server.js');

function runServer(directory) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: directory,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Bundled server did not exit after a failed database connection. Output: ${output}`));
    }, 10_000);

    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ code, output });
    });
  });
}

test.before(async () => {
  assert.ok(process.env.npm_execpath, 'tests should be run through pnpm');
  await execFileAsync(process.execPath, [process.env.npm_execpath, 'run', 'build'], { cwd: backendDir });
});

test('build produces a standalone server that falls back to deployment settings from .env', async () => {
  const bundle = await readFile(bundledServer, 'utf8');
  assert.ok(bundle.length > 0, 'dist/server.js should contain the bundled application');

  const deploymentDir = await mkdtemp(path.join(os.tmpdir(), 'travel-helper-server-'));
  try {
    await copyFile(bundledServer, path.join(deploymentDir, 'server.js'));
    await writeFile(
      path.join(deploymentDir, '.env'),
      'BACKEND_PORT=19077\nDB_HOST=127.0.0.1\nDB_PORT=1\nDB_USER=test\nDB_PASSWORD=test\nDB_NAME=test\n',
      'utf8'
    );

    const result = await runServer(deploymentDir);
    assert.notEqual(result.code, 0, 'the intentionally invalid database should stop the server');
    assert.match(result.output, /Failed to start backend API\./);
    assert.match(result.output, /127\.0\.0\.1:1/);
    assert.doesNotMatch(result.output, /Cannot find module/);
  } finally {
    await rm(deploymentDir, { recursive: true, force: true });
  }
});

test('bundled server prefers .env.production over the generic .env fallback', async () => {
  const deploymentDir = await mkdtemp(path.join(os.tmpdir(), 'travel-helper-server-'));
  try {
    await copyFile(bundledServer, path.join(deploymentDir, 'server.js'));
    await writeFile(
      path.join(deploymentDir, '.env'),
      'DB_HOST=127.0.0.1\nDB_PORT=1\nDB_USER=test\nDB_PASSWORD=test\nDB_NAME=test\n',
      'utf8'
    );
    await writeFile(
      path.join(deploymentDir, '.env.production'),
      'DB_HOST=127.0.0.1\nDB_PORT=2\nDB_USER=test\nDB_PASSWORD=test\nDB_NAME=test\n',
      'utf8'
    );

    const result = await runServer(deploymentDir);
    assert.notEqual(result.code, 0, 'the intentionally invalid database should stop the server');
    assert.match(result.output, /127\.0\.0\.1:2/);
    assert.doesNotMatch(result.output, /127\.0\.0\.1:1/);
  } finally {
    await rm(deploymentDir, { recursive: true, force: true });
  }
});
