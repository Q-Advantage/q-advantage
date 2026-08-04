# context/ — read-only vault bridge (not implemented yet)

This directory is meant to hold a **read-only** view of a narrow slice of the founder's knowledge vault: technical decision records, the P-CBOM spec, benchmark/measurement ethics notes, architecture notes. Not outreach, not content, not pitch material — see `CLAUDE.md`.

**Status:** deferred. The sync mechanism (symlink / git submodule / sync script) is undecided pending the vault's actual location. See `docs/adr/0002-context-vault-bridge-deferred.md`.

Until this is implemented:
- There is nothing to read here.
- Never write to this directory from a Forge session — it is meant to be read-only once live, and right now it's just this placeholder.
