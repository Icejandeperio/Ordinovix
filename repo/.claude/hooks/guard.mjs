#!/usr/bin/env node
/**
 * Ordinovix guard — PreToolUse hook for Claude Code (human-owned; do not let agents edit).
 *
 * Blocks (exit 2, reason on stderr):
 *  - git: push to main/master, force push, push --all/--mirror, deleting main, --no-verify,
 *         commits on main/master, reset --hard, clean -f, discarding the working tree, filter-branch,
 *         global git config writes
 *  - gh: merge --admin, repo delete/edit/archive/rename/transfer, secrets/variables, mutating `gh api`
 *  - npm: installing packages not listed in docs/adr/approved-deps.json, global installs, publish;
 *         npx of binaries not on the allowlist; pnpm/yarn/bun installs
 *  - any wrangler command (backend phase is human-gated), curl|sh style pipes,
 *    recursive deletes of protected roots, reading .env files
 *  - file edits (Edit/Write/MultiEdit/NotebookEdit and shell writes) to protected paths;
 *    modifying existing files in tests/acceptance/ (creating new ones is allowed)
 * Everything else exits 0 and goes through the normal permission flow (auto mode classifier).
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const IS_WIN = process.platform === 'win32';

// ---------- configuration ----------
const PROTECTED_FILES = [
  'AGENTS.md', 'CLAUDE.md', 'scripts/verify.mjs', 'scripts/verify.ps1', 'eslint.config.js',
  'playwright.config.ts', 'docs/state/QA_AUDIT_2026-10-27.md',
];
const PROTECTED_DIRS = ['.claude/', '.github/', 'docs/product/', 'docs/adr/', 'Inspirations/', '.git/'];
const ACCEPTANCE_DIR = 'tests/acceptance/';
const RATCHET_FILE = 'tests/acceptance/known-failures.json';
const PROTECTED_RM_ROOTS = new Set(['.', '..', '/', '~', '*', '.git', 'src', 'tests', 'docs', '.claude',
  '.github', 'scripts', 'public', 'Inspirations', 'node_modules/..']);
const DEFAULT_APPROVED = {
  packages: [],
  npxBins: ['tsc', 'vitest', 'vite', 'eslint', 'playwright'],
};

// ---------- helpers ----------
function block(reason) {
  process.stderr.write(`Blocked by Ordinovix guard: ${reason}\n` +
    'Do not retry this another way. If it is genuinely needed, record it in docs/state/QUEUE.md (T3) and continue with other work.\n');
  process.exit(2);
}

function readStdin() {
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

function norm(p) {
  return p.replace(/\\/g, '/');
}

function relToProject(projectDir, filePath) {
  const abs = path.resolve(projectDir, filePath);
  let rel = norm(path.relative(projectDir, abs));
  return rel;
}

function eqPath(a, b) {
  return IS_WIN ? a.toLowerCase() === b.toLowerCase() : a === b;
}
function startsPath(a, prefix) {
  return IS_WIN ? a.toLowerCase().startsWith(prefix.toLowerCase()) : a.startsWith(prefix);
}

function isEnvFile(rel) {
  const base = rel.split('/').pop() || '';
  return base === '.env' || base.startsWith('.env.');
}

/** Returns a reason string if `rel` (project-relative, forward slashes) is protected for writing. */
function protectedWriteReason(rel, projectDir) {
  if (!rel || rel.startsWith('../') || rel === '..') {
    // outside the project: protect Claude Code's own config
    const r = norm(rel);
    if (/(^|\/)\.claude(\/|$)/.test(r) || /(^|\/)\.claude\.json$/.test(r)) {
      return `${rel} is Claude Code configuration outside the project.`;
    }
    return null;
  }
  if (isEnvFile(rel)) return `${rel} is an environment/secrets file.`;
  for (const f of PROTECTED_FILES) if (eqPath(rel, f)) return `${rel} is a protected human-owned file.`;
  for (const d of PROTECTED_DIRS) if (startsPath(rel + '/', d) || startsPath(rel, d)) return `${rel} is inside protected ${d}`;
  if (startsPath(rel, ACCEPTANCE_DIR)) {
    if (eqPath(rel, RATCHET_FILE)) return null; // may only shrink; enforced by scripts/verify.mjs
    if (existsSync(path.join(projectDir, rel))) {
      return `${rel} is an existing acceptance test (the oracle). Fix the app, not the test. New test files in ${ACCEPTANCE_DIR} are allowed.`;
    }
    return null;
  }
  return null;
}

function loadApproved(projectDir) {
  try {
    const j = JSON.parse(readFileSync(path.join(projectDir, 'docs/adr/approved-deps.json'), 'utf8'));
    return {
      packages: Array.isArray(j.packages) ? j.packages.map((p) => (typeof p === 'string' ? p : p.name)) : [],
      npxBins: Array.isArray(j.npxBins) ? j.npxBins : DEFAULT_APPROVED.npxBins,
    };
  } catch {
    return DEFAULT_APPROVED;
  }
}

function currentBranch(dir) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000,
    }).trim();
  } catch {
    return '';
  }
}

/** Split a shell command into segments on unquoted ; && || | & newline ( ) ` */
function segments(cmd) {
  const out = [];
  let cur = '';
  let q = null; // quote char
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) {
      if (c === '\\' && q === '"' && i + 1 < cmd.length) { cur += c + cmd[++i]; continue; }
      if (c === q) q = null;
      cur += c;
      continue;
    }
    if (c === '\\' && i + 1 < cmd.length) { cur += c + cmd[++i]; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === ';' || c === '\n' || c === '|' || c === '&' || c === '(' || c === ')' || c === '`') {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Tokenize one segment, removing quotes. Quoted text becomes one token. */
function tokens(seg) {
  const out = [];
  let cur = '';
  let has = false;
  let q = null;
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i];
    if (q) {
      if (c === '\\' && q === '"' && i + 1 < seg.length) { cur += seg[++i]; continue; }
      if (c === q) { q = null; continue; }
      cur += c;
      continue;
    }
    if (c === '"' || c === "'") { q = c; has = true; continue; }
    if (c === '\\' && i + 1 < seg.length) { cur += seg[++i]; has = true; continue; }
    if (/\s/.test(c)) { if (has || cur) out.push(cur); cur = ''; has = false; continue; }
    cur += c; has = true;
  }
  if (has || cur) out.push(cur);
  return out;
}

/** Strip leading env assignments and wrappers (timeout, time, nice, nohup, command, builtin, exec, sudo). */
function stripWrappers(t) {
  let i = 0;
  while (i < t.length) {
    const x = t[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(x)) { i++; continue; }
    if (['time', 'nohup', 'command', 'builtin', 'exec', 'sudo', 'xargs'].includes(x)) { i++; continue; }
    if (x === 'nice') { i++; if (t[i] === '-n') i += 2; continue; }
    if (x === 'timeout') { i++; while (t[i] && t[i].startsWith('-')) i++; i++; continue; }
    break;
  }
  return t.slice(i);
}

function progName(tok) {
  const b = norm(tok || '').split('/').pop() || '';
  return b.replace(/\.(exe|cmd|bat)$/i, '');
}

const isMainRef = (r) => /^(refs\/heads\/)?(main|master)$/.test(r);

function checkGit(t, cwd) {
  // t[0] is git
  let i = 1;
  let dir = cwd;
  while (i < t.length && t[i].startsWith('-')) {
    const o = t[i];
    if (o === '-C') { dir = path.resolve(cwd, t[i + 1] || '.'); i += 2; continue; }
    if (o === '-c') { i += 2; continue; }
    i++;
  }
  const sub = t[i];
  const args = t.slice(i + 1);
  const has = (...flags) => args.some((a) => flags.includes(a));
  if (!sub) return;

  if (sub === 'push') {
    if (args.some((a) => a === '--no-verify')) block('git push --no-verify skips checks.');
    if (args.some((a) => a === '-f' || a === '--force' || a.startsWith('--force-with-lease') || a === '--force-if-includes' ||
      (/^-[a-zA-Z]*f[a-zA-Z]*$/.test(a) && !a.startsWith('--')))) block('force push rewrites published history.');
    if (has('--all', '--mirror', '--prune')) block('git push --all/--mirror/--prune can touch main or delete branches.');
    const positional = args.filter((a) => !a.startsWith('-'));
    const refs = positional.slice(1); // first positional is the remote
    for (const r of refs) {
      if (r.startsWith('+')) block('force push via +refspec rewrites published history.');
      const dst = r.includes(':') ? r.split(':').pop() : r;
      if (isMainRef(dst) || isMainRef(r)) block('pushing to main/master. Push your unit branch and merge with `gh pr merge --squash` after CI passes.');
      if (r.startsWith(':') && isMainRef(r.slice(1))) block('deleting main/master on the remote.');
    }
    if (has('--delete', '-d') && refs.some(isMainRef)) block('deleting main/master on the remote.');
    const headLike = refs.some((r) => ['HEAD', '@'].includes(r.split(':')[0]) && !r.includes(':'));
    if (refs.length === 0 || headLike) {
      const b = currentBranch(dir);
      if (isMainRef(b)) block(`you are on ${b}; a bare push would update it. Work on a unit branch.`);
    }
    return;
  }
  if (sub === 'commit') {
    if (has('--no-verify', '-n')) block('git commit --no-verify skips checks.');
    const b = currentBranch(dir);
    if (isMainRef(b)) block(`committing directly on ${b}. Create a unit branch first: git switch -c u<NN>-<slug>`);
    return;
  }
  if (sub === 'reset' && has('--hard')) block('git reset --hard discards work. Use git stash or git restore <file>.');
  if (sub === 'clean' && args.some((a) => /^-[a-zA-Z]*f/.test(a) || a === '--force')) block('git clean -f deletes untracked files.');
  if (sub === 'checkout' && (args.includes('.') || (args.includes('--') && args.slice(args.indexOf('--') + 1).includes('.'))))
    block('git checkout . discards all working-tree changes. Restore specific files instead.');
  if (sub === 'restore' && args.includes('.') && !has('--staged', '-S')) block('git restore . discards all working-tree changes. Restore specific files instead.');
  if (sub === 'branch' && has('-D', '-d', '--delete') && args.some(isMainRef)) block('deleting the main branch.');
  if (sub === 'filter-branch' || sub === 'filter-repo') block('history rewriting is not allowed.');
  if (sub === 'update-ref' && has('-d')) block('deleting refs is not allowed.');
  if (sub === 'config' && has('--global', '--system')) block('changing global git configuration.');
  if (sub === 'rebase' && args.some(isMainRef) && currentBranch(dir) && isMainRef(currentBranch(dir))) block('rebasing main.');
}

function checkGh(t) {
  const a = t.slice(1);
  const [g, s] = a;
  if (g === 'pr' && s === 'merge' && a.includes('--admin')) block('gh pr merge --admin bypasses required checks.');
  if (g === 'repo' && ['delete', 'edit', 'archive', 'rename', 'transfer', 'unarchive'].includes(s)) block(`gh repo ${s} changes repository settings (T3).`);
  if (['secret', 'variable', 'ruleset', 'ssh-key', 'gpg-key', 'auth'].includes(g) && !(g === 'auth' && s === 'status'))
    block(`gh ${g} ${s || ''} touches credentials or repository policy (T3).`);
  if (g === 'release' && s !== 'list' && s !== 'view') block('releases are human-owned (T3).');
  if (g === 'workflow' && ['disable', 'enable', 'run'].includes(s)) block('changing or triggering workflows is human-owned (T3).');
  if (g === 'api') {
    const m = a.findIndex((x) => x === '-X' || x === '--method');
    const method = m >= 0 ? (a[m + 1] || '').toUpperCase() : (a.some((x) => x.startsWith('--method=')) ? a.find((x) => x.startsWith('--method=')).split('=')[1].toUpperCase() : 'GET');
    const hasFields = a.some((x) => ['-f', '-F', '--field', '--raw-field', '--input'].includes(x));
    if (method !== 'GET' || hasFields) block('mutating GitHub API calls are not allowed; use gh pr commands.');
  }
}

function pkgName(spec) {
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    if (parts.length < 2) return spec;
    return parts[0] + '/' + parts[1].split('@')[0];
  }
  return spec.split('@')[0];
}

function checkNpm(t, approved) {
  const a = t.slice(1);
  const sub = a.find((x) => !x.startsWith('-'));
  if (!sub) return;
  if (sub === 'publish' || sub === 'unpublish' || sub === 'deprecate' || sub === 'owner' || sub === 'login' || sub === 'adduser' || sub === 'token')
    block(`npm ${sub} is not allowed.`);
  if (['install', 'i', 'add', 'isntall', 'in', 'ins', 'inst', 'insta', 'instal', 'isnt', 'isnta', 'isntal'].includes(sub)) {
    if (a.includes('-g') || a.includes('--global') || a.includes('--location=global')) block('global npm installs are not allowed.');
    const specs = a.slice(a.indexOf(sub) + 1).filter((x) => !x.startsWith('-'));
    for (const s of specs) {
      if (/^(file:|git\+|https?:|github:|\.|\/)/.test(s) || s.includes('/') && !s.startsWith('@')) block(`installing from a URL, path or git (${s}) is not allowed.`);
      const name = pkgName(s);
      if (!approved.packages.includes(name)) {
        block(`package "${name}" is not in docs/adr/approved-deps.json. Propose it in docs/state/QUEUE.md (T3).`);
      }
    }
  }
  if (sub === 'exec' || sub === 'x') {
    const bin = a[a.indexOf(sub) + 1];
    if (bin && !approved.npxBins.includes(progName(bin))) block(`npm exec ${bin} is not on the allowlist.`);
  }
}

function checkNpx(t, approved) {
  const a = t.slice(1);
  let i = 0;
  while (i < a.length && a[i].startsWith('-')) {
    if (a[i] === '-p' || a[i] === '--package') block('npx --package downloads arbitrary packages.');
    i++;
  }
  const bin = a[i];
  if (!bin) return;
  const name = progName(bin);
  if (name === 'wrangler') block('wrangler commands belong to the human-gated backend phase (T3).');
  if (!approved.npxBins.includes(name)) block(`npx ${bin} is not on the allowlist (${approved.npxBins.join(', ')}).`);
}

function checkRm(t) {
  const flags = t.slice(1).filter((x) => x.startsWith('-')).join('');
  const recursive = /r|R/.test(flags) || t.includes('--recursive');
  if (!recursive) return;
  const targets = t.slice(1).filter((x) => !x.startsWith('-')).map((x) => norm(x).replace(/\/+$/, '') || '/');
  for (const x of targets) {
    if (PROTECTED_RM_ROOTS.has(x) || x.startsWith('~') || x.startsWith('/') || /^[A-Za-z]:/.test(x) || x.includes('..'))
      block(`recursive delete of "${x}" is not allowed. Only build outputs (dist, test-results, playwright-report, coverage) may be removed.`);
  }
}

const WRITE_PROGS = new Set(['tee', 'cp', 'mv', 'rm', 'truncate', 'install', 'ln', 'chmod', 'touch', 'dd', 'rsync']);

function checkShellWrites(seg, t, projectDir, cwd) {
  // redirections and in-place editors that target protected paths
  const prog = progName(t[0]);
  const inPlace = (prog === 'sed' || prog === 'perl') && t.some((x) => x === '-i' || x.startsWith('-i') || x === '--in-place');
  const redirTargets = [];
  const re = />>?\s*("([^"]+)"|'([^']+)'|([^\s;&|]+))/g;
  let m;
  while ((m = re.exec(seg))) redirTargets.push(m[2] || m[3] || m[4]);
  const candidates = new Set(redirTargets);
  if (inPlace || WRITE_PROGS.has(prog) || prog === 'git' && t[1] === 'checkout' && t.includes('--')) {
    for (const x of t.slice(1)) if (!x.startsWith('-')) candidates.add(x);
  }
  for (const c of candidates) {
    if (!c || c.startsWith('&') || c === '/dev/null' || c === 'nul' || c === 'NUL') continue;
    const rel = relToProject(projectDir, path.resolve(cwd, c));
    const reason = protectedWriteReason(rel, projectDir);
    // For cp/mv the *source* may be protected (reading is fine); only block when it is a destination or the prog deletes/edits
    if (reason) {
      if ((prog === 'cp' || prog === 'rsync' || prog === 'install' || prog === 'ln') && !redirTargets.includes(c)) {
        const nonFlags = t.slice(1).filter((x) => !x.startsWith('-'));
        if (nonFlags[nonFlags.length - 1] !== c) continue; // only the destination counts
      }
      block(`shell write to ${reason}`);
    }
  }
}

function checkEnvRead(t) {
  const readers = new Set(['cat', 'type', 'less', 'more', 'head', 'tail', 'grep', 'rg', 'awk', 'sed', 'Get-Content', 'gc', 'source', '.', 'bat', 'strings', 'xxd', 'od']);
  if (!readers.has(progName(t[0])) && progName(t[0]) !== 'Get-Content') return;
  for (const x of t.slice(1)) if (!x.startsWith('-') && isEnvFile(norm(x))) block('reading .env files is not allowed.');
}

// ---------- main ----------
function main() {
  const raw = readStdin();
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch { process.exit(0); }
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const cwd = input.cwd || projectDir;
  const tool = input.tool_name || '';
  const ti = input.tool_input || {};

  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const fp = ti.file_path || ti.notebook_path || ti.path;
    if (!fp) process.exit(0);
    const rel = relToProject(projectDir, path.resolve(cwd, fp));
    const reason = protectedWriteReason(rel, projectDir);
    if (reason) block(reason + ' Propose the exact change in docs/state/QUEUE.md instead.');
    process.exit(0);
  }

  if (tool === 'Bash' || tool === 'PowerShell') {
    const cmd = String(ti.command || '');
    const approved = loadApproved(projectDir);
    if (/\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^\n]*\|\s*(sh|bash|zsh|iex|Invoke-Expression|powershell|pwsh|node|python3?)\b/i.test(cmd))
      block('piping downloaded content into a shell or interpreter.');
    if (/--dangerously-skip-permissions|--permission-mode\s+bypassPermissions/.test(cmd)) block('starting Claude Code without permissions.');
    for (const seg of segments(cmd)) {
      const t = stripWrappers(tokens(seg));
      if (t.length === 0) continue;
      const prog = progName(t[0]);
      if (prog === 'git') checkGit(t, cwd);
      else if (prog === 'gh') checkGh(t);
      else if (prog === 'npm') checkNpm(t, approved);
      else if (prog === 'npx') checkNpx(t, approved);
      else if (prog === 'pnpm' || prog === 'yarn' || prog === 'bun') {
        if (t.slice(1).some((x) => ['add', 'install', 'i', 'dlx', 'x'].includes(x))) block(`${prog} is not used here; use npm with approved packages.`);
      } else if (prog === 'wrangler') block('wrangler commands belong to the human-gated backend phase (T3).');
      else if (prog === 'rm' || prog === 'rmdir') checkRm(t);
      else if (prog === 'Remove-Item' || prog === 'ri' || prog === 'del' || prog === 'rd') {
        if (t.some((x) => /^-r(ecurse)?$/i.test(x) || x === '/s')) block('recursive delete via PowerShell/cmd is not allowed.');
      }
      checkEnvRead(t);
      checkShellWrites(seg, t, projectDir, cwd);
    }
    process.exit(0);
  }
  process.exit(0);
}

main();
