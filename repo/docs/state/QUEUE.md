# Owner decision queue

Items here need the owner (Icejan). The agent adds items and never resolves them itself.
To answer one, tell the agent in a Claude Code session (for example: "Decision for U07: option A"). The agent
records your words under the item, ticks it, moves it to "Decided", and sets the blocked unit back to `pending`
on its next branch. Decisions that change a protected file (for example approving a new package in
`docs/adr/approved-deps.json`) are made by you through a pull request on GitHub, because `main` is protected.

## Open

Entry format: a checkbox line `- [ ] <YYYY-MM-DD> U<NN> <short question> (blocks U<NN>)`, followed by indented
lines for Context (one or two lines, link to the PR or draft PR), Options with a recommendation and its reason,
and, for protected files, the exact change proposed.

## Proposals (ideas outside the backlog; not scheduled)

## Decided
