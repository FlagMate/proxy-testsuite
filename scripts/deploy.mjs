#!/usr/bin/env node
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');

const MONOREPO_ROOT = resolve(ROOT, '..');
const DASHBOARD_TEST_DIR = join(MONOREPO_ROOT, 'proxy-dashboard', 'public', 'test');
const LANDING_TEST_DIR = join(MONOREPO_ROOT, 'proxy-landing', 'public', 'test');

const DEPLOYMENT_DASHBOARD_TEST_DIR = join(MONOREPO_ROOT, 'DEPLOYMENT', 'proxy-dashboard', 'public', 'test');
const DEPLOYMENT_LANDING_TEST_DIR = join(MONOREPO_ROOT, 'DEPLOYMENT', 'proxy-landing', 'public', 'test');

console.log('[testsuite:deploy] Building proxy-testsuite with Vite...');
execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });

const indexHtmlPath = join(DIST, 'index.html');
if (!existsSync(indexHtmlPath)) {
  console.error('[testsuite:deploy] Error: dist/index.html was not generated!');
  process.exit(1);
}

function deployToDirectory(targetDir, label) {
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
  }
  mkdirSync(targetDir, { recursive: true });
  cpSync(DIST, targetDir, { recursive: true });

  // Patch asset paths in index.html for subpath /test
  const htmlFile = join(targetDir, 'index.html');
  if (existsSync(htmlFile)) {
    let html = readFileSync(htmlFile, 'utf8');
    html = html.replace(/src="\.\/([^"]+)"/g, 'src="/test/$1"');
    html = html.replace(/href="\.\/([^"]+)"/g, 'href="/test/$1"');
    const buildTs = Date.now();
    html = html.replace(/\brestifysdk\.js\b/g, `restifysdk.js?v=${buildTs}`);
    html = html.replace(/\brestifystyle\.css\b/g, `restifystyle.css?v=${buildTs}`);
    writeFileSync(htmlFile, html, 'utf8');
  }

  console.log(`[testsuite:deploy] Deployed -> ${label}`);
}

// 1. Deploy to proxy-dashboard/public/test
deployToDirectory(DASHBOARD_TEST_DIR, 'proxy-dashboard/public/test');

// 2. Deploy to proxy-landing/public/test
deployToDirectory(LANDING_TEST_DIR, 'proxy-landing/public/test');

// 3. Mirror to DEPLOYMENT targets if folders exist
if (existsSync(dirname(DEPLOYMENT_DASHBOARD_TEST_DIR))) {
  deployToDirectory(DEPLOYMENT_DASHBOARD_TEST_DIR, 'DEPLOYMENT/proxy-dashboard/public/test');
}
if (existsSync(dirname(DEPLOYMENT_LANDING_TEST_DIR))) {
  deployToDirectory(DEPLOYMENT_LANDING_TEST_DIR, 'DEPLOYMENT/proxy-landing/public/test');
}

console.log('[testsuite:deploy] Deployment complete.');
