# ADR 0002: `context/` vault bridge deferred

## Status

Proposed — 2026-08-04 — deferred, not accepted, pending founder input

## Context

`CLAUDE.md` calls for a `context/` directory acting as a read-only view into a narrow slice of the founder's knowledge vault (technical decision records, the P-CBOM spec, benchmark/measurement ethics notes, architecture notes — explicitly not outreach, content, or pitch material). Implementing this requires knowing where that vault actually lives on disk and picking a sync mechanism (git submodule, symlink, or a small sync script).

This session could not locate the vault. There's an `Obsidian.lnk` shortcut on the founder's Desktop, but its target vault folder was not identified, and guessing at a path risked either failing loudly (harmless) or, worse, pointing at the wrong directory. Two clarifying questions asked about this went unanswered mid-session.

## Decision

Defer implementation. `context/README.md` exists as a placeholder describing the intended purpose and stating plainly that the bridge isn't wired up yet. `CLAUDE.md` documents this status so no session mistakes silence for "there's nothing relevant" when the real state is "this hasn't been built."

## Next step (`#todo`, needs founder input)

1. Founder provides the actual vault path (or confirms it's an Obsidian vault and where it's mounted).
2. Pick a mechanism:
   - **Symlink** — simplest, works only if the Forge and vault are on the same machine (they currently are). No sync lag, but breaks if either moves.
   - **Git submodule** — works across machines, versioned, but adds submodule-management overhead for a solo founder (explicitly discouraged for `p-cbom` in the master governance plan for the same reason).
   - **Sync script** — most flexible (can filter to just the allowed slice), most to maintain.
   - Given this is one person on one machine today, a symlink is the likely right default — but that's the founder's call, not a default to silently apply.
3. Update this ADR's status to Accepted once chosen, implement it, and add the resulting sync target to `.gitignore` if the mechanism copies rather than links (so vault content — which may name people — never enters this public repo's git history).

## Consequences of deferring

None of the done-definition items for this session depend on `context/` being live. Work-orders can proceed without it; anything that would benefit from vault context just doesn't have it yet, same as before this session.
