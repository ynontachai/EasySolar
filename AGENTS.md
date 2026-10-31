<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## EasySolar delivery rules

- Treat responsive behavior as part of every UI feature, not as follow-up polish.
- Before considering UI work complete, verify the affected routes at 390px, 768px, and 1440px viewport widths.
- Do not introduce horizontal page overflow. Reflow dense data, controls, and navigation instead of clipping required information.
- Keep navigation and primary actions available on mobile, with visible keyboard focus and at least 24px interactive target dimensions.
- Document any intentionally hidden secondary information and preserve access to the underlying decision-critical data.

## Token budget for agents

Read `docs/codex-operating-rules.md` before starting work. It limits screenshot viewing, large reads, and thread length.
