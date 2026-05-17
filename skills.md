# skills.md

Reference for Claude Code skills available in this workspace. Invoke a skill by typing `/<skill-name>` in chat. Skills are *specialized prompts* — they shape how Claude approaches a task. They are not project commands.

## Project-relevant skills

### `/init`
Generates or refreshes [CLAUDE.md](CLAUDE.md) by analyzing the codebase. Use after a major architectural change (new model, new dashboard, route splitting, lint/test scripts added).

### `/review`
Reviews a pull request — diff, intent, and risk surface. Useful before merging changes that touch the assignment-reconciliation logic in [server/index.js:241](server/index.js#L241), the cron jobs in [server/scheduler.js](server/scheduler.js), or any of the three large dashboard components.

### `/security-review`
Audits pending changes on the current branch for security issues. Especially relevant here given the project's known limitations: plaintext passwords, no auth middleware, hardcoded Cloudinary credentials. Run before any change that touches `/api/login`, `/api/register`, file uploads, or push-notification subscriptions.

### `/simplify`
Reviews changed code for reuse, quality, and efficiency, then fixes issues. Useful in this repo because each dashboard component is 2k–6k lines and accumulates duplicated fetch/format helpers.

### `/fewer-permission-prompts`
Scans transcripts for repeated read-only Bash/MCP calls and adds them to [.claude/settings.local.json](.claude/settings.local.json). Run if you find yourself approving the same `npm test` / `git status` style commands repeatedly.

### `/claude-api`
Build, debug, or migrate code that uses the Anthropic SDK. **Not currently relevant** — this project does not call the Claude API.

## Harness-configuration skills

### `/update-config`
Edits `.claude/settings.json` / `settings.local.json`. Use for permission allow-lists, env vars, or hooks (automated behaviors that fire on tool events). The current project config is at [.claude/settings.local.json](.claude/settings.local.json) and only allow-lists a few git/npx commands.

### `/keybindings-help`
Customize keyboard shortcuts in `~/.claude/keybindings.json`. Global to the user, not project-specific.

## Scheduling skills

### `/loop`
Run a prompt or slash command on a recurring interval (e.g. `/loop 5m /review`). Omit the interval to let the model self-pace. Use for polling a long-running task — not for one-offs.

### `/schedule`
Create / update / list cron-scheduled remote agents. Distinct from the in-process `node-cron` jobs in [server/scheduler.js](server/scheduler.js) — `/schedule` runs Claude Code itself on a cadence.

## Notes

- This list reflects the skills exposed by the current Claude Code installation. New skills may appear in future versions; check the system reminder at session start for the authoritative list.
- Skills are not the same as **subagents** (`Agent` tool with `subagent_type`). Subagents run a separate Claude instance with its own context window; skills are prompt templates loaded into the current conversation.
- Skills are not the same as **hooks**. Hooks are shell commands the harness runs on tool events (configured via `/update-config`); skills are user-invoked.
