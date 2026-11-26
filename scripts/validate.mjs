import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const fail = (message) => {
  console.error(`VALIDATION FAILED: ${message}`);
  process.exit(1);
};
const readJSON = (file) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { fail(`${file}: ${error.message}`); }
};

const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('main.js', 'utf8');
const pkg = readJSON('package.json');
const cap = readJSON('capacitor.config.json');
const manifest = readJSON('public/manifest.json');

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) fail(`Duplicate HTML id(s): ${[...new Set(duplicates)].join(', ')}`);

const referencedIds = [...js.matchAll(/\$\('([^']+)'\)/g)].map((match) => match[1]);
const missingIds = [...new Set(referencedIds)].filter((id) => !ids.includes(id));
if (missingIds.length) fail(`JavaScript refers to missing HTML id(s): ${missingIds.join(', ')}`);

if (!html.includes('src="./main.js"')) fail('index.html must load ./main.js');
if (!fs.existsSync('main.js')) fail('main.js is missing');
if (!fs.existsSync('public/icon-192.png') || !fs.existsSync('public/icon-512.png')) fail('App icons are missing');
if (!fs.existsSync('public/manifest.json')) fail('PWA manifest is missing');
if (!pkg.dependencies?.['@capacitor-community/camera-preview']) fail('Camera preview dependency is missing');
if (cap.webDir !== 'dist') fail('Capacitor webDir must be dist for Vite');
if (manifest.icons?.length < 2) fail('Manifest must include both app icons');

try {
  execFileSync(process.execPath, ['--check', 'main.js'], { stdio: 'inherit' });
} catch {
  fail('main.js has a JavaScript syntax error');
}

console.log(`Validation passed: ${ids.length} HTML ids, ${new Set(referencedIds).size} static JS element references, JSON and source paths.`);
