#!/usr/bin/env node
/**
 * Ordinovix verification gate (human-owned; see docs/adr/ADR-0001).
 *
 *   node scripts/verify.mjs            typecheck, lint, unit, build, acceptance (+ ratchet)
 *   node scripts/verify.mjs --fast     typecheck, lint, unit
 *   node scripts/verify.mjs --no-e2e   everything except acceptance
 *
 * Ratchet rules for tests/acceptance (titles start with an ID such as "B02 ..." or "U07 ..."):
 *   1. A failing test whose ID is not in known-failures.json fails the gate (regression).
 *   2. An ID in known-failures.json whose tests all pass fails the gate until the ID is removed.
 *   3. An ID listed but with no tests fails the gate (stale entry).
 *   4. A branch may not add IDs that origin/main does not list.
 *   5. Skipped acceptance tests fail the gate.
 * Works on Windows (Git Bash or PowerShell), macOS, Linux and CI.
 */
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const FAST = args.has('--fast');
const NO_E2E = args.has('--no-e2e') || FAST;
const RESULTS_FILE = path.join('test-results', 'acceptance-results.json');
const KNOWN_FILE = 'tests/acceptance/known-failures.json';

const summary = [];
let failed = false;

function run(name, cmd, env = {}) {
  const started = Date.now();
  process.stdout.write(`\n=== ${name}: ${cmd}\n`);
  const r = spawnSync(cmd, { stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const ok = r.status === 0;
  summary.push(`${ok ? 'PASS' : 'FAIL'}  ${name} (${secs}s)`);
  if (!ok) failed = true;
  return ok;
}

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function mainKnownIds() {
  try {
    const txt = execFileSync('git', ['show', `origin/main:${KNOWN_FILE}`], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(txt).ids || [];
  } catch {
    return null; // no origin/main copy yet (first introduction) or no remote
  }
}

// Strips terminal colour codes from Playwright error messages.
// eslint-disable-next-line no-control-regex -- ESC is the point of this pattern
const ANSI = /\x1b\[[0-9;]*m/g;

function collectTests(report) {
  const out = [];
  const walk = (suite) => {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        const last = (t.results || [])[t.results.length - 1] || {};
        out.push({ title: spec.title, file: spec.file, status: t.status || last.status, error: (last.error?.message || '').replace(ANSI, '') });
      }
    }
    for (const s of suite.suites || []) walk(s);
  };
  for (const s of report.suites || []) walk(s);
  return out;
}

function ratchet() {
  if (!existsSync(RESULTS_FILE)) {
    summary.push('FAIL  ratchet (no Playwright JSON results; did the run start? Try: npx playwright install chromium)');
    failed = true;
    return;
  }
  const known = existsSync(KNOWN_FILE) ? (readJson(KNOWN_FILE).ids || []) : [];
  const onMain = mainKnownIds();
  const problems = [];

  if (onMain) {
    const added = known.filter((id) => !onMain.includes(id));
    if (added.length) problems.push(`known-failures.json adds IDs not listed on origin/main: ${added.join(', ')} (the list may only shrink)`);
  }

  const tests = collectTests(readJson(RESULTS_FILE));
  const byId = new Map();
  for (const t of tests) {
    const id = (/^([BU]\d{2})\b/.exec(t.title) || [])[1] || null;
    const passed = t.status === 'expected' || t.status === 'passed';
    const skipped = t.status === 'skipped';
    if (skipped) { problems.push(`skipped acceptance test: "${t.title}"`); continue; }
    if (id) {
      const e = byId.get(id) || { pass: 0, fail: 0 };
      if (passed) e.pass++; else e.fail++;
      byId.set(id, e);
    }
    if (!passed && (!id || !known.includes(id))) {
      problems.push(`REGRESSION: "${t.title}" failed${id ? '' : ' (title has no ID)'}${t.error ? ` — ${t.error.split('\n')[0].slice(0, 160)}` : ''}`);
    }
  }
  for (const id of known) {
    const e = byId.get(id);
    if (!e) problems.push(`stale entry ${id} in known-failures.json: no acceptance test has this ID`);
    else if (e.fail === 0) problems.push(`${id} now passes (${e.pass} test${e.pass > 1 ? 's' : ''}): remove it from known-failures.json`);
  }

  const passing = [...byId.entries()].filter(([, e]) => e.fail === 0).map(([id]) => id).sort();
  const expectedFail = known.filter((id) => byId.get(id)?.fail > 0);
  console.log(`\n=== ratchet: ${tests.length} acceptance tests; passing IDs: ${passing.join(', ') || 'none'}; ` +
    `known failures still failing: ${expectedFail.join(', ') || 'none'}`);
  if (problems.length) {
    for (const p of problems) console.log(`  - ${p}`);
    summary.push(`FAIL  ratchet (${problems.length} problem${problems.length > 1 ? 's' : ''})`);
    failed = true;
  } else {
    summary.push(`PASS  ratchet (known failures remaining: ${expectedFail.length ? expectedFail.join(', ') : 'none'})`);
  }
}

// ---- steps ----
run('typecheck', 'npx tsc --noEmit');
run('lint', 'npx eslint . --max-warnings=-1');
run('unit', 'npx vitest run');
if (!FAST) run('build', 'npx vite build');
if (!NO_E2E) {
  mkdirSync('test-results', { recursive: true });
  rmSync(RESULTS_FILE, { force: true }); // never judge stale results
  run('acceptance', 'npx playwright test --reporter=list,json', {
    PLAYWRIGHT_JSON_OUTPUT_FILE: RESULTS_FILE,
    PLAYWRIGHT_JSON_OUTPUT_NAME: RESULTS_FILE,
  });
  // A non-zero Playwright exit is expected while known failures exist; the ratchet decides.
  summary.pop();
  summary.push('INFO  acceptance run finished (ratchet decides pass/fail)');
  failed = summary.some((s) => s.startsWith('FAIL'));
  ratchet();
}

console.log('\n=== GATE SUMMARY');
for (const s of summary) console.log('GATE ' + s);
console.log(`GATE RESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
