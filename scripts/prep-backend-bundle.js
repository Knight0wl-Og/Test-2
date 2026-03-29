#!/usr/bin/env node
/**
 * Copies backend production deps (+ transitive) from the workspace root
 * node_modules into backend/node_modules so electron-builder can bundle them.
 * Needed because npm workspaces hoists all packages to root node_modules.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcModules = path.join(root, 'node_modules');
const dstModules = path.join(root, 'backend', 'node_modules');

fs.mkdirSync(dstModules, { recursive: true });

function copyDep(name, visited = new Set()) {
  if (visited.has(name)) return;
  visited.add(name);

  const src = path.join(srcModules, name);
  const dst = path.join(dstModules, name);
  if (!fs.existsSync(src)) return;
  if (fs.existsSync(dst)) return;

  fs.cpSync(src, dst, { recursive: true });

  const depPkg = path.join(src, 'package.json');
  if (fs.existsSync(depPkg)) {
    const { dependencies = {} } = JSON.parse(fs.readFileSync(depPkg, 'utf8'));
    for (const child of Object.keys(dependencies)) copyDep(child, visited);
  }
}

const { dependencies = {} } = JSON.parse(
  fs.readFileSync(path.join(root, 'backend', 'package.json'), 'utf8')
);

for (const dep of Object.keys(dependencies)) copyDep(dep);

const count = fs.readdirSync(dstModules).length;
console.log(`backend/node_modules ready: ${count} packages`);
