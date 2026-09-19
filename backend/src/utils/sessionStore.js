const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { config } = require('../config');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function readSession() {
  try {
    const raw = await fs.readFile(config.auth.sessionFile, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeSession(session) {
  await fs.mkdir(path.dirname(config.auth.sessionFile), { recursive: true });

  const tempFile = `${config.auth.sessionFile}.${process.pid}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
  await fs.rename(tempFile, config.auth.sessionFile);
}

async function issueToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  const session = {
    token_hash: hashToken(token),
    session_id: crypto.randomUUID(),
    issued_at: now,
    updated_at: now
  };

  await writeSession(session);

  return {
    token,
    session_id: session.session_id,
    issued_at: session.issued_at
  };
}

async function verifyToken(token) {
  if (!token) {
    return false;
  }

  const session = await readSession();
  if (!session?.token_hash) {
    return false;
  }

  const providedHash = Buffer.from(hashToken(token), 'hex');
  const storedHash = Buffer.from(session.token_hash, 'hex');

  if (providedHash.length !== storedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedHash, storedHash);
}

module.exports = {
  issueToken,
  verifyToken
};
