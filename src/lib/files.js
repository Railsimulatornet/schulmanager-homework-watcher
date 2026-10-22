const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o770 });
}

function ensureDirs(paths) {
  for (const dirPath of paths) ensureDir(dirPath);
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  writeText(filePath, JSON.stringify(value, null, 2) + '\n');
}

function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, value, { encoding: 'utf8', mode: 0o660 });
  fs.renameSync(temporary, filePath);
}

function removeIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { recursive: true, force: true });
  }
}

function listFilesRecursive(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const result = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        result.push(fullPath);
      }
    }
  }

  return result;
}

module.exports = {
  ensureDir,
  ensureDirs,
  readJson,
  writeJson,
  writeText,
  removeIfExists,
  listFilesRecursive
};
