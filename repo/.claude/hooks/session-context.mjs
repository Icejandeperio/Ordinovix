#!/usr/bin/env node
/**
 * Ordinovix session context — SessionStart hook (human-owned).
 * Prints the current work state as factual context so every session (new, resumed, after /clear or
 * compaction) starts from the files, not from memory. Never blocks; always exits 0.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const read = (p) => { try { return readFileSync(path.join(dir, p), 'utf8'); } catch { return null; } };
const git = (...a) => {
  try { return execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim(); }
  catch { return ''; }
};

const lines = [];
const branch = git('rev-parse', '--abbrev-ref', 'HEAD') || 'unknown';
const dirty = git('status', '--porcelain').split('\n').filter(Boolean).length;
lines.push(`Git branch: ${branch}; uncommitted files: ${dirty}.`);

const backlogRaw = read('docs/state/backlog.json');
if (backlogRaw) {
  try {
    const b = JSON.parse(backlogRaw);
    const units = b.units || [];
    const done = new Set(units.filter((u) => u.status === 'done').map((u) => u.id));
    const inProgress = units.filter((u) => u.status === 'in_progress');
    const blocked = units.filter((u) => u.status === 'blocked');
    const next = units.find((u) => u.status === 'pending' && (u.depends_on || []).every((d) => done.has(d)));
    lines.push(`Backlog: ${done.size}/${units.length} units done, ${inProgress.length} in progress, ${blocked.length} blocked. Stop point: ${b.stop_after || 'none'}.`);
    for (const u of inProgress) lines.push(`In progress: ${u.id} — ${u.title}${u.pr ? ` (PR ${u.pr})` : ''}.`);
    if (next) lines.push(`Next eligible unit: ${next.id} — ${next.title} (tier ${next.tier}).`);
    else if (!inProgress.length) lines.push('No pending unit has all its dependencies done.');
    if (b.stop_after && done.has(b.stop_after)) lines.push(`The stop point ${b.stop_after} is done; the autonomous run is complete.`);
  } catch {
    lines.push('docs/state/backlog.json could not be parsed.');
  }
} else {
  lines.push('docs/state/backlog.json is missing.');
}

const progress = read('docs/state/PROGRESS.md');
if (progress) {
  const last = progress.split('\n').find((l) => l.startsWith('## '));
  if (last) lines.push(`Most recent PROGRESS.md entry: ${last.replace(/^## /, '')}.`);
}
const queue = read('docs/state/QUEUE.md');
if (queue) {
  const open = queue.split('\n').filter((l) => /^\s*- \[ \]/.test(l)).length;
  lines.push(`Open items waiting for the owner in docs/state/QUEUE.md: ${open}.`);
}
lines.push('Workflow commands available in this project: /next-unit, /run-backlog, /ship; subagent: verifier.');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'Ordinovix work state:\n' + lines.join('\n') },
}));
process.exit(0);
