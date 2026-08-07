# ADR 0002: `context/` vault bridge

## Status

Accepted — implemented 2026-08-06. Originally proposed 2026-08-04 as deferred, pending the vault's location; the founder has since supplied it.

## Context

`CLAUDE.md` calls for a `context/` directory acting as a read-only view into a narrow slice of the founder's knowledge vault (technical decision records, the P-CBOM spec, benchmark/measurement ethics notes, architecture notes — explicitly not outreach, content, or pitch material). Implementing this requires knowing where that vault actually lives on disk and picking a sync mechanism (git submodule, symlink, or a small sync script).

This session could not locate the vault. There's an `Obsidian.lnk` shortcut on the founder's Desktop, but its target vault folder was not identified, and guessing at a path risked either failing loudly (harmless) or, worse, pointing at the wrong directory. Two clarifying questions asked about this went unanswered mid-session.

## Decision

Implemented as a **Windows junction**: `context/` → `C:\Users\Dell\q-advantage-vault\50-technical`, created by the founder outside of any Forge session and confirmed working (resolves to the vault's technical slice — `measurement-ethics.md`, `decisions/`, etc.).

Of the three options this ADR originally weighed:
- **Symlink** — not used; Windows junctions don't require the elevated privilege or Developer Mode that Windows symlinks typically do, and behave the same way for this same-machine, directory-only case.
- **Git submodule** — rejected, per the original reasoning (submodule overhead for a solo founder, already discouraged elsewhere in this repo's governance).
- **Sync script** — rejected as unneeded complexity when a junction satisfies the same-machine case directly.

`context/` is now git-ignored in full (see `.gitignore`) — nothing under it enters this repo's history. The pre-junction placeholder `context/README.md` (a real repo file) is dropped from git tracking, since that path now resolves into the vault, not the repo; a new `README.md` describing the bridge from the vault side lives at `50-technical/README.md` in the vault itself. `CLAUDE.md`'s "Context bridge to the vault" section documents the read-only rule this junction is subject to: nothing in this repo may write through it.

## Consequences

- **Same-machine only.** If the Forge repo or the vault ever move to separate machines, this junction breaks and needs to be re-created (or the ADR revisited toward the sync-script option).
- **Read-only by convention, not by OS enforcement.** A junction doesn't itself block writes — the read-only guarantee comes from `CLAUDE.md`'s rule and session discipline, same as the other repo conventions here. A session that writes through `context/` is writing directly into the vault.
- **Freshness is whatever the vault currently holds.** There's no sync step and no review gate between a vault edit and it appearing under `context/` — treat contents as live, not as a reviewed snapshot.
