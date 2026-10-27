---
name: ship
description: Commit, push, open the PR, wait for CI, and squash-merge the current Ordinovix unit branch. Use at the end of a unit after the gate passes.
disable-model-invocation: true
---

Preconditions: you are on a `u<NN>-...` branch (never `main`), `node scripts/verify.mjs` exited 0 on the
current commit, and (T2) the verifier returned PASS.

1. `git add -A` then review `git diff --cached --stat`. Nothing outside the unit's scope, no protected paths,
   no secrets, no `.env`, no `test-results/` or `playwright-report/`.
2. Commit any remaining changes: `<type>(<area>): <what changed> [U<NN>][B<NN>]`.
3. `git push -u origin HEAD`.
4. Open the PR (skip if one exists for this branch: `gh pr list --head <branch>`):
   `gh pr create --base main --title "U<NN>: <plain-language outcome> (<bug IDs>)" --body-file tmp/pr-body.md`
   Write the body to `tmp/pr-body.md` (gitignored) from `.github/pull_request_template.md`: contract, what
   changed, evidence (paste the `verify.mjs` summary, tests turned green, verifier verdict for T2), assumptions,
   risk, rollback (`git revert <sha>`).
5. Record the unit now that the PR number exists:
   - `docs/state/backlog.json`: this unit `status: "done"`, `pr: <number>`, `evidence: "<gate result; tests turned green>"`.
   - `docs/state/PROGRESS.md`: new entry directly under the `# Progress Log` title (format in `AGENTS.md`;
     cite `PR #<number>`; the merge sha is in git history, do not guess it).
   - Commit `docs(state): record U<NN> [U<NN>]` and `git push -u origin HEAD`.
6. `gh pr checks <number> --watch --interval 30`. If it reports that no checks exist yet, list runs with
   `gh run list --branch <branch> --limit 3` until one appears, then watch it. If a check fails:
   `gh run view <run-id> --log-failed`, fix on the branch, rerun the gate, `git push -u origin HEAD`, and watch again.
7. All checks green → `gh pr merge <number> --squash --delete-branch`.
   If merging is refused (branch protection, conflicts): rebase is not allowed; merge `main` into the branch
   (`git fetch origin && git merge origin/main`), rerun the gate, push, and retry. If still refused, set the unit
   to `blocked` with the reason, push, and stop.
8. `git switch main && git pull --ff-only`. Confirm the squash commit is on `main` (`git log -1 --oneline`).
