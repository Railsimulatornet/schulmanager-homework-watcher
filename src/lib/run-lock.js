const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { ensureDir } = require('./files');

function processStart(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)[19] || null;
  } catch (_) {
    return null;
  }
}

function acquireRunLock(config) {
  const filePath = path.join(config.stateDir, 'run.lock');
  ensureDir(config.stateDir);
  const owner = { pid: process.pid, start: processStart(process.pid), nonce: crypto.randomBytes(12).toString('hex'), createdAt: new Date().toISOString() };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(owner), { flag: 'wx', mode: 0o600 });
      return () => {
        try {
          const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (current.nonce === owner.nonce) fs.rmSync(filePath);
        } catch (_) { /* Ein fremder Lauf verwaltet seine eigene Sperre. */ }
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let current = null;
      try { current = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) { /* beschädigte Sperre */ }
      if (current?.pid && current.start && processStart(current.pid) === current.start) return null;
      try { fs.rmSync(filePath); } catch (_) { /* Ein anderer Lauf war schneller. */ }
    }
  }
  return null;
}

module.exports = { acquireRunLock };
