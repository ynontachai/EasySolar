# Codex operating rules (token budget)

Written for: Codex and any agent working in this repo. Read before starting a task.

## Why these rules exist

A measured session (`rollout-2026-10-27T14-58-34`, one thread) used:

- 1,085 `exec` calls and 1,344 model calls across 60 turns.
- About 22 MB of tool output.
- 34 tool outputs over 200 KB. The largest were full-resolution screenshots from `artifacts/` opened with `view_image` at `detail: "high"`, up to 1.4 MB each.
- About 170 M cumulative input tokens, almost all cached context re-read every turn.

Every image or large output stays in the context and is re-read on each later turn. The cost comes from long threads that hold big outputs, not from one expensive call.

## Rules

1. **Images**
   - Do not open `../EasySolar-artifacts/`, `.playwright-mcp/`, or any screenshot with `view_image` unless the task is a visual check that cannot be verified another way.
   - At most 3 images per task. Crop to the element, or downscale to 800 px wide or less.
   - Prefer DOM or text checks (`read_page`, `get_page_text`, `curl` status and timing) over screenshots.
   - Do not add new screenshots to the repo. Screenshots live outside the repo at `../EasySolar-artifacts/`. `.playwright-mcp/` stays gitignored and local only.

2. **Reads and searches**
   - Use `rg` with `--glob '!node_modules' --glob '!.next' --glob '!artifacts' --glob '!.playwright-mcp'`.
   - Read files in ranges (`offset`/`limit`). Never `cat` lock files, `*.log`, `*.yml` snapshots, or `*.sqlite`.
   - Use `git diff --stat` and `git show --stat` before reading whole diffs.
   - Cap command output with `| head -n 200` unless the full output is needed.
   - Never run `find` on the repo root without `-maxdepth` or a path filter.

3. **Thread hygiene**
   - One slice per thread. Start a new thread when the task changes.
   - Compact or start fresh when the thread passes about 50% of context, or after roughly 150 tool calls.
   - Write a handoff in `docs/` (see `docs/handoff-codex-admin-invite.md`) instead of carrying long history.

4. **Loops**
   - If the same tool call fails twice, stop and report. Do not retry in a loop.
   - Batch independent reads and checks into one tool call where the tools allow it.

5. **Effort and scope**
   - Default to medium reasoning effort. Use high only for schema, security, or money-impact design.
   - Do not expand scope mid-task. Log new findings in the handoff and continue the current slice.

6. **Verification without heavy output**
   - Run checks quietly and report the summary: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Quote only failing lines.

## Notes for the human operator (not enforced by repo)

These live in `~/.codex/config.toml` and are not changed by this repo:

- `model_reasoning_effort = "high"` is set globally. Consider `"medium"`.
- `multi_agent = true` allows sub-agents, which multiply token use. Turn it off unless needed.
- Many plugins are enabled (gmail, google-drive, google-calendar, slack, documents, pdf, spreadsheets, presentations, template-creator, visualize). Each adds tool schemas to every turn. Disable those not used for this repo.
- The Vercel MCP and Playwright MCP are only needed for deploy and browser checks.
