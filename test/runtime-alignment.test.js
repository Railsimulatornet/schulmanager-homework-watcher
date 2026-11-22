const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Playwright package, lockfile and browser image use the same version', () => {
  const root = path.join(__dirname, '..');
  const packageData = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json')));
  const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
  const image = dockerfile.match(/^FROM mcr\.microsoft\.com\/playwright:v([0-9]+\.[0-9]+\.[0-9]+)-noble$/m);
  assert.ok(image, 'Playwright browser image must be selected explicitly');
  assert.equal(packageData.dependencies.playwright, image[1]);
  assert.equal(lock.packages['node_modules/playwright'].version, image[1]);
});
